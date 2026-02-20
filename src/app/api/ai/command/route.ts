import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type {
  ViewportCommandPayload,
  FindResultPayload,
} from "@/lib/ai/tools/types";
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
- For "remove all", "clear board", "delete all objects": call clearBoard. It deletes everything in one call.
- Call getBoardState first before creating connectors, moving, or deleting (need object ids).
- For "create two shapes then connect them" (e.g. "create two circles, connect with double arrow"): ALWAYS use createShapesAndConnect in ONE call. Do NOT use createShape + createConnector separately.

For creating stickies: For 1 sticky use createStickyNote. For 2–24 stickies use createStickies. For 25–100 stickies use createManyStickies with totalCount and topic—it creates them all in one shot (no user confirmation).

For "create X ideas then classify on a graph" (e.g. "Create 50 feature ideas, classify on time vs impact"): (1) createManyStickies first, (2) then clusterStickiesOnGridWithAI or clusterStickiesByQuadrantWithAI with the axis labels. Use clusterStickiesByQuadrantWithAI for "quadrants" or "four quadrants"; use clusterStickiesOnGridWithAI for continuous placement. Always do BOTH steps.

For "classify", "categorize", or "group" stickies: call getBoardState first. For 2D graphs: use clusterStickiesOnGridWithAI (continuous) or clusterStickiesByQuadrantWithAI (four quadrants)—they score and place stickies automatically. For "quadrants" or "four quadrants" use clusterStickiesByQuadrantWithAI. Use clusterStickies for frames with bold titles; classifyStickies for simple layout.

Coordinates: x increases right, y increases down. Typical sticky ~180x120. To move objects into frames, use moveObject with parentId.

For "Create SWOT analysis": create 4 frames, add stickies inside each.

For "follow X", "watch X", "follow [name]": call followUser with displayNameOrId. Match by first name, last name, full name, or partial (e.g. "follow joh" matches John). If follow fails, call listBoardUsers and tell the user who's on the board. For "unfollow", "stop following": call unfollowUser.

For "who else is in this room", "who's here", "who's on the board", "who can I see": call listBoardUsers and report the names.

For "zoom in", "zoom out", "pan left", "frame to fit", "show everything": use zoomViewport, panViewport, or frameViewportToContent.

For "find X", "show me the sticky about Y", "where is Z": use findObjects with the search query. NEVER respond with JSON—always use natural language. For multiple matches, list options with numbers and ask the user to pick.

Respond with a brief summary only. Never output JSON, code blocks, or raw data.`;

const DATA_FETCHING_TOOLS = new Set(["getBoardState", "getStickyCount"]);
const MAX_CREATED_ENTITIES_PER_TURN = 100;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

type RateLimitEntry = {
  count: number;
  windowStartMs: number;
};

const CREATE_MANY_STICKIES_SCHEMA = z.object({
  totalCount: z.number(),
});
const CREATE_STICKIES_SCHEMA = z.object({
  stickies: z.array(z.unknown()),
});
const CREATE_STICKERS_SCHEMA = z.object({
  stickers: z.array(z.unknown()),
});

function getRateLimitStore(): Map<string, RateLimitEntry> {
  const globalState = globalThis as typeof globalThis & {
    __aiCommandRateLimitStore?: Map<string, RateLimitEntry>;
  };
  if (!globalState.__aiCommandRateLimitStore) {
    globalState.__aiCommandRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalState.__aiCommandRateLimitStore;
}

function checkRateLimit(key: string, nowMs = Date.now()): {
  limited: boolean;
  retryAfterSeconds?: number;
} {
  const store = getRateLimitStore();
  const current = store.get(key);
  if (!current || nowMs - current.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    store.set(key, { count: 1, windowStartMs: nowMs });
    return { limited: false };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (nowMs - current.windowStartMs);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);
  return { limited: false };
}

function isLikelyOffTopic(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  const whiteboardHints = [
    /\b(board|whiteboard|sticky|stickies|sticker|shape|frame|connector|line|canvas|object|objects)\b/,
    /\b(create|add|move|resize|delete|remove|clear|classify|cluster|group|find|zoom|pan|follow|unfollow)\b/,
    /\b(help|commands|capabilities|what can you do)\b/,
  ];
  if (whiteboardHints.some((re) => re.test(normalized))) return false;

  const offTopicHints = [
    /\b(weather|temperature|forecast)\b/,
    /\b(stock|stocks|crypto|bitcoin|market price)\b/,
    /\b(news|headlines)\b/,
    /\b(recipe|cook|cooking)\b/,
    /\b(joke|poem|story|essay)\b/,
    /\b(email|write an email|draft an email)\b/,
    /\b(set an alarm|timer|reminder)\b/,
  ];

  return offTopicHints.some((re) => re.test(normalized));
}

function estimateCreatedEntities(
  toolName: string,
  args: Record<string, unknown>,
): number {
  switch (toolName) {
    case "createManyStickies": {
      const parsed = CREATE_MANY_STICKIES_SCHEMA.safeParse(args);
      if (!parsed.success) return 0;
      return Math.max(0, Math.floor(parsed.data.totalCount));
    }
    case "createStickies": {
      const parsed = CREATE_STICKIES_SCHEMA.safeParse(args);
      if (!parsed.success) return 0;
      return parsed.data.stickies.length;
    }
    case "createStickers": {
      const parsed = CREATE_STICKERS_SCHEMA.safeParse(args);
      if (!parsed.success) return 0;
      return parsed.data.stickers.length;
    }
    case "createStickyNote":
    case "createShape":
    case "createFrame":
    case "createText":
    case "createConnector":
    case "createLine":
      return 1;
    case "createShapesAndConnect":
      return 3;
    default:
      return 0;
  }
}

function looksLikeRawJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

function synthesizeResponseFromTools(
  toolCallsTrace: Array<{ name: string; result: string; isError: boolean }>,
): string {
  if (toolCallsTrace.length === 0) return "Done.";
  const supported = toolCallsTrace.find((t) => t.name === "getSupportedCommands");
  if (supported) return supported.result;
  const errors = toolCallsTrace.filter((t) => t.isError);
  const successes = toolCallsTrace
    .filter((t) => !t.isError && !DATA_FETCHING_TOOLS.has(t.name))
    .map((t) => t.result);
  const errorMsgs = errors.map((e) => e.result);
  const parts: string[] = [];
  if (successes.length) parts.push(successes.join(". "));
  if (errorMsgs.length) parts.push(errorMsgs.join("; "));
  const text = parts.join(". ");
  if (!text) return "Done.";
  if (looksLikeRawJson(text)) {
    return errorMsgs.length
      ? `Something went wrong: ${errorMsgs.join("; ")}`
      : "Something went wrong. Please try again.";
  }
  return text;
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

  const rateLimitKey = `${user.id}:${boardId}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (rateLimit.limited) {
    return NextResponse.json(
      {
        error:
          "Too many AI command requests for this board. Please wait a few seconds and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 1),
        },
      },
    );
  }

  const isFollowUp = messagesList.length > 2;
  if (isLikelyOffTopic(lastUserContent)) {
    return new Response(
      "I can only help with whiteboard commands in this board.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

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

  const broadcastViewportCommand = (payload: ViewportCommandPayload) => {
    void channel.send({
      type: "broadcast",
      event: "viewport_command",
      payload,
    });
  };

  const broadcastFindResult = (payload: FindResultPayload) => {
    void channel.send({
      type: "broadcast",
      event: "find_result",
      payload,
    });
  };

  const baseCtx = {
    boardId,
    supabase,
    broadcast,
    broadcastViewportCommand,
    broadcastFindResult,
    objects,
  };

  const ctxRef = { current: { ...baseCtx, objects } };
  let capturedFollowingUserId: string | null | undefined = undefined;
  const execCtx = {
    ctx: ctxRef.current,
    openai: openaiClient,
    currentUserId: user.id,
    onFollowSuccess: (userId: string | null) => {
      capturedFollowingUserId = userId;
    },
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
  let createdEntitiesThisTurn = 0;

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
          const jsonHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (capturedFollowingUserId !== undefined) {
            jsonHeaders["X-Following-User-Id"] = capturedFollowingUserId ?? "";
          }
          return NextResponse.json(
            {
              text,
              debug: {
                perf,
                toolCalls: toolCallsTrace,
              },
            },
            { headers: jsonHeaders },
          );
        }
        const headers: Record<string, string> = {
          "Content-Type": "text/plain; charset=utf-8",
        };
        if (capturedFollowingUserId !== undefined) {
          headers["X-Following-User-Id"] = capturedFollowingUserId ?? "";
        }
        return new Response(text, { headers });
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
        const estimatedCreates = estimateCreatedEntities(name, args);
        if (
          estimatedCreates > 0 &&
          createdEntitiesThisTurn + estimatedCreates >
            MAX_CREATED_ENTITIES_PER_TURN
        ) {
          const remaining = Math.max(
            0,
            MAX_CREATED_ENTITIES_PER_TURN - createdEntitiesThisTurn,
          );
          result =
            remaining === 0
              ? `Error: Creation limit reached. This request can create at most ${MAX_CREATED_ENTITIES_PER_TURN} objects per turn.`
              : `Error: This step would create ${estimatedCreates} objects, but only ${remaining} can be created this turn (limit: ${MAX_CREATED_ENTITIES_PER_TURN}).`;
          toolCallsTrace.push({
            name,
            args,
            result: result.slice(0, 500),
            isError: true,
            ms: Date.now() - toolStart,
          });
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
          continue;
        }
        try {
          result = await executeTool(name, args, execCtx);
          createdEntitiesThisTurn += estimatedCreates;
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

      // Continue loop: let the AI call more tools (e.g. deleteObjects after getBoardState)
      // or produce a final response. Only return when we get no tool_calls.
    }

    const text =
      synthesizeResponseFromTools(toolCallsTrace) ||
      "Reached max steps without a final response.";
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
      const jsonHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (capturedFollowingUserId !== undefined) {
        jsonHeaders["X-Following-User-Id"] = capturedFollowingUserId ?? "";
      }
      return NextResponse.json(
        {
          text,
          debug: {
            perf,
            toolCalls: toolCallsTrace,
          },
        },
        { headers: jsonHeaders },
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
    };
    if (capturedFollowingUserId !== undefined) {
      headers["X-Following-User-Id"] = capturedFollowingUserId ?? "";
    }
    return new Response(text, { headers });
  } catch (err) {
    console.error("[AI command] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
