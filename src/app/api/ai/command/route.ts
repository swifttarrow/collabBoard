import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { TOOLS, executeTool } from "@/lib/ai/openai-tools";
import { loadObjects } from "./loadObjects";

const INPUT_SCHEMA = z
  .object({
    boardId: z.string().uuid(),
    command: z.string().min(1).max(2000).optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      )
      .min(1)
      .max(50)
      .optional(),
    debug: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.command != null ||
      (data.messages != null && data.messages.length > 0),
    {
      message: "Either command or messages must be provided",
    },
  );

const SYSTEM_PROMPT = `You are a whiteboard assistant. You MUST call tools to execute every command. You NEVER write essays, docs, or long text.

RULES:
- Always use tools. Keep replies brief. NEVER claim to have done something without actually calling the tool.
- EXCEPTION—getSupportedCommands: When the user asks "what can you do", "help", "commands", "capabilities"—call getSupportedCommands. Your reply MUST be the EXACT text returned by that tool. Output it verbatim; never reply with just "Done" or a summary.
- Never output markdown, code blocks, documentation, or raw JSON. Never echo tool results verbatim—use natural language only (e.g. "Created 20 stickies" not {"stickyCount":20}).
- For "remove all", "clear board", "delete all objects": call getBoardState, then deleteObjects with object ids (max 25 per call). If more than 25 objects, call deleteObjects again with remaining ids until done.
- Call getBoardState first before creating connectors, moving, or deleting (need object ids).
- For "create two shapes then connect them" (e.g. "create two circles, connect with double arrow"): ALWAYS use createShapesAndConnect in ONE call. Do NOT use createShape + createConnector separately.

For creating stickies: For 1 sticky use createStickyNote. For 2–24 stickies use createStickies. For 25–100 stickies use createManyStickies with totalCount and topic—it creates them all in one shot (no user confirmation).

For "classify", "categorize", or "group" stickies: call getBoardState first, then classifyStickies with categories from sticky content.

Coordinates: x increases right, y increases down. Typical sticky ~180x120. To move objects into frames, use moveObject with parentId.

For "Create SWOT analysis": create 4 frames, add stickies inside each.

For "follow X", "watch X", "follow [name]": call followUser with displayNameOrId (first name, last name, or full name). User must be on the board.

Respond with a brief summary only.`;

function synthesizeResponseFromTools(
  toolCallsTrace: Array<{ name: string; result: string; isError: boolean }>,
): string {
  if (toolCallsTrace.length === 0) return "Done.";
  const supported = toolCallsTrace.find((t) => t.name === "getSupportedCommands");
  if (supported) return supported.result;
  const errors = toolCallsTrace.filter((t) => t.isError);
  if (errors.length === toolCallsTrace.length) {
    return errors.map((e) => e.result).join("; ");
  }
  const successes = toolCallsTrace
    .filter((t) => !t.isError)
    .map((t) => t.result);
  return successes.join(". ");
}

type OpenAIMessage =
  | OpenAI.Chat.Completions.ChatCompletionMessageParam
  | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;

export async function POST(req: Request) {
  const t0 = Date.now();
  const supabase = await createClient();
  const authStart = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authMs = Date.now() - authStart;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof INPUT_SCHEMA>;
  const bodyParseStart = Date.now();
  try {
    body = INPUT_SCHEMA.parse(await req.json());
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid input. Expected { boardId, command } or { boardId, messages }",
      },
      { status: 400 },
    );
  }

  const bodyParseMs = Date.now() - bodyParseStart;
  const { boardId, command, messages, debug: debugMode } = body;
  const messagesList =
    messages ??
    (command != null ? [{ role: "user" as const, content: command }] : []);
  const lastUserContent =
    messagesList.filter((m) => m.role === "user").pop()?.content ??
    command ??
    "";

  const boardCheckStart = Date.now();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .single();
  const boardCheckMs = Date.now() - boardCheckStart;

  if (boardError || !board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const isOwner = board.owner_id === user.id;
  const membershipStart = Date.now();
  const { data: membership } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle();
  const membershipMs = Date.now() - membershipStart;

  if (!isOwner && !membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const isFollowUp = messagesList.length > 2;
  console.log("[AI command] received", {
    boardId,
    messageCount: messagesList.length,
    isFollowUp,
    lastUser: lastUserContent.slice(0, 150),
    debugMode,
  });

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const loadObjectsStart = Date.now();
  const objects = await loadObjects(supabase, boardId);
  const loadObjectsMs = Date.now() - loadObjectsStart;
  const channelSubscribeStart = Date.now();
  const channel = supabase.channel(`board_objects:${boardId}`, {
    config: { broadcast: { self: false } },
  });
  await channel.subscribe();
  const channelSubscribeMs = Date.now() - channelSubscribeStart;

  const broadcast = (payload: {
    op: "INSERT" | "UPDATE" | "DELETE";
    object?: BoardObjectWithMeta;
    id?: string;
    updated_at?: string;
  }) => {
    void channel.send({
      type: "broadcast",
      event: "board_objects",
      payload,
    });
  };

  const baseCtx = {
    boardId,
    supabase,
    broadcast,
    objects,
  };

  const ctxRef = { current: { ...baseCtx, objects } };
  const execCtx = {
    ctx: ctxRef.current,
    openai: openaiClient,
    currentUserId: user.id,
  };

  const apiMessages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messagesList.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolCallsTrace: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
    isError: boolean;
    ms?: number;
  }> = [];
  const openaiCallsMs: number[] = [];
  const loadObjectsRefreshMs: number[] = [];
  const MAX_STEPS = 12;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const callStart = Date.now();
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 2048,
      });
      openaiCallsMs.push(Date.now() - callStart);

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) {
        console.warn("[AI command] empty completion");
        break;
      }

      apiMessages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      if (!msg.tool_calls?.length) {
        const text = (msg.content ?? "").trim() || "Done.";
        const totalMs = Date.now() - t0;
        if (!debugMode) {
          console.log("[AI command] perf", {
            totalMs,
            authMs,
            bodyParseMs,
            boardCheckMs,
            membershipMs,
            loadObjectsMs,
            channelSubscribeMs,
            openaiCallsMs,
            toolCalls: toolCallsTrace.map((t) => ({ name: t.name, ms: t.ms })),
          });
        }
        if (debugMode) {
          const toolCallsMs = toolCallsTrace.map((t) => t.ms ?? 0);
          const perf = {
            totalMs,
            authMs,
            bodyParseMs,
            boardCheckMs,
            membershipMs,
            loadObjectsMs,
            channelSubscribeMs,
            openaiCallsMs,
            toolCallsMs,
            loadObjectsRefreshMs,
            setupMs: authMs + bodyParseMs + boardCheckMs + membershipMs + loadObjectsMs + channelSubscribeMs,
          };
          console.log("[AI command] perf", perf, "toolCalls", toolCallsTrace.map((t) => ({ name: t.name, ms: t.ms })));
          return NextResponse.json(
            {
              text,
              debug: {
                perf,
                toolCalls: toolCallsTrace,
              },
            },
            { headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(text, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      for (const tc of msg.tool_calls) {
        const name = tc.function?.name ?? "unknown";
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments ?? "{}") as Record<
            string,
            unknown
          >;
        } catch {}

        const toolStart = Date.now();
        let result: string;
        try {
          result = await executeTool(name, args, execCtx);
        } catch (err) {
          result =
            err instanceof Error ? err.message : String(err);
        }
        const toolMs = Date.now() - toolStart;

        toolCallsTrace.push({
          name,
          args,
          result: result.slice(0, 500),
          isError: result.startsWith("Error:"),
          ms: toolMs,
        });

        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Synthesize response from tool results and return (skip second LLM call for final text)
      const text = synthesizeResponseFromTools(toolCallsTrace);
      const totalMs = Date.now() - t0;

      if (!debugMode) {
        console.log("[AI command] perf", {
          totalMs,
          authMs,
          bodyParseMs,
          boardCheckMs,
          membershipMs,
          loadObjectsMs,
          channelSubscribeMs,
          openaiCallsMs,
          toolCalls: toolCallsTrace.map((t) => ({ name: t.name, ms: t.ms })),
        });
      }
      if (debugMode) {
        const toolCallsMs = toolCallsTrace.map((t) => t.ms ?? 0);
        const perf = {
          totalMs,
          authMs,
          bodyParseMs,
          boardCheckMs,
          membershipMs,
          loadObjectsMs,
          channelSubscribeMs,
          openaiCallsMs,
          toolCallsMs,
          loadObjectsRefreshMs,
          setupMs: authMs + bodyParseMs + boardCheckMs + membershipMs + loadObjectsMs + channelSubscribeMs,
        };
        console.log("[AI command] perf", perf, "toolCalls", toolCallsTrace.map((t) => ({ name: t.name, ms: t.ms })));
        return NextResponse.json(
          {
            text,
            debug: {
              perf,
              toolCalls: toolCallsTrace,
            },
          },
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const text = "Reached max steps without a final response.";
    if (debugMode) {
      const totalMs = Date.now() - t0;
      const toolCallsMs = toolCallsTrace.map((t) => t.ms ?? 0);
      const perf = {
        totalMs,
        authMs,
        bodyParseMs,
        boardCheckMs,
        membershipMs,
        loadObjectsMs,
        channelSubscribeMs,
        openaiCallsMs,
        toolCallsMs,
        loadObjectsRefreshMs,
        setupMs: authMs + bodyParseMs + boardCheckMs + membershipMs + loadObjectsMs + channelSubscribeMs,
      };
      console.log("[AI command] perf", perf, "toolCalls", toolCallsTrace.map((t) => ({ name: t.name, ms: t.ms })));
      return NextResponse.json(
        {
          text,
          debug: {
            perf,
            toolCalls: toolCallsTrace,
          },
        },
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[AI command] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
