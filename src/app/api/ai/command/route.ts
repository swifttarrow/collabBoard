import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { rowToObject } from "@/lib/board/sync";
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

const SUPPORTED_COMMANDS = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups
• Follow a user: sync your view to theirs (e.g. "follow Jane", "watch John")`;

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

  const { boardId, command, messages, debug: debugMode } = body;
  const messagesList =
    messages ??
    (command != null ? [{ role: "user" as const, content: command }] : []);
  const lastUserContent =
    messagesList.filter((m) => m.role === "user").pop()?.content ??
    command ??
    "";

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const isOwner = board.owner_id === user.id;
  const { data: membership } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle();

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

  // Help intent: quick completion without tools
  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const helpCheckStart = Date.now();
  const helpCompletion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: `Is the user asking what the assistant can do, what commands are supported, for help, capabilities, features, or options? Examples: "what can you do", "help", "what is possible?", "list your features". Reply with exactly YES or NO.

User said: "${lastUserContent.trim()}"

Reply:`,
      },
    ],
  });
  const helpCheckMs = Date.now() - helpCheckStart;
  const intentReply =
    helpCompletion.choices[0]?.message?.content?.trim() ?? "NO";
  const isHelpQuery = /^\s*y(es)?\b/i.test(intentReply);
  console.log("[AI command] intent check", { intentReply, isHelpQuery });

  if (isHelpQuery) {
    console.log("[AI command] returning early: classified as help query");
    if (debugMode) {
      const totalMs = Date.now() - t0;
      return NextResponse.json(
        {
          text: SUPPORTED_COMMANDS,
          debug: {
            perf: {
              totalMs,
              authMs,
              helpCheckMs,
              openaiCallsMs: [helpCheckMs],
            },
            toolCalls: [],
          },
        },
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(SUPPORTED_COMMANDS, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const objects = await loadObjects(supabase, boardId);
  const channel = supabase.channel(`board_objects:${boardId}`, {
    config: { broadcast: { self: false } },
  });
  await channel.subscribe();

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
  }> = [];
  const openaiCallsMs: number[] = [];
  const toolCallsMs: number[] = [];
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
        if (debugMode) {
          const totalMs = Date.now() - t0;
          return NextResponse.json(
            {
              text,
              debug: {
                perf: {
                  totalMs,
                  authMs,
                  openaiCallsMs,
                  toolCallsMs,
                },
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
        toolCallsMs.push(Date.now() - toolStart);

        toolCallsTrace.push({
          name,
          args,
          result: result.slice(0, 500),
          isError: result.startsWith("Error:"),
        });

        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      const freshObjects = await loadObjects(supabase, boardId);
      ctxRef.current = { ...baseCtx, objects: freshObjects };
      execCtx.ctx = ctxRef.current;
    }

    const text = "Reached max steps without a final response.";
    if (debugMode) {
      const totalMs = Date.now() - t0;
      return NextResponse.json(
        {
          text,
          debug: {
            perf: {
              totalMs,
              authMs,
              openaiCallsMs,
              toolCallsMs,
            },
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
