import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type {
  ViewportCommandPayload,
  FindResultPayload,
} from "@/lib/ai/tools/types";
import {
  AI_TOOLS,
  executeAITool,
  estimateCreatedEntities,
} from "@/lib/ai/ai-tools";
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
    viewportCenter: z
      .object({ x: z.number(), y: z.number() })
      .optional(),
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
- Always use tools. Keep replies brief. NEVER claim to have done something without calling the tool.
- Single LLM turn: Call all needed tools in one response. Do not expect another turn.
- Call getBoardState ONLY for move, resize, arrange, find—never for createStickyNote, createShape, or createFrame (creation tools do not need it).
- Never output markdown, code blocks, or raw JSON. Use natural language only.
- If the request is unclear or ambiguous, ask for clarification. If you cannot complete it, say so.
- Only manipulate objects on this board via the provided tools. You cannot do anything else.

Creation:
- 1 sticky: createStickyNote. 2+ stickies: createBulkStickies with stickies array and optional layoutPlan (cols, rows, spacing, startX, startY).
- createShape for rect/circle, createFrame for frames.
- Max 100 entities per creation. New items get viewport focus automatically.

Manipulation: moveObject, resizeObject, updateText, changeColor. Need getBoardState for IDs.

Layout: arrangeInGrid, spaceEvenly. Call getBoardState first.

Find: findObjects(query, offset?, limit?). 1 match → viewport focuses. 2+ matches → list top 3 with links; user can say "show more" for next 3.

View: zoomViewport, panViewport, frameViewportToContent.

Coordinates: x right, y down. Typical sticky ~180×120.`;

const MAX_CREATED_ENTITIES = 100;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

type RateLimitEntry = {
  count: number;
  windowStartMs: number;
};

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
    /\b(board|whiteboard|sticky|stickies|shape|frame|canvas|object|objects)\b/,
    /\b(create|add|move|resize|delete|remove|arrange|find|zoom|pan|help)\b/,
  ];
  if (whiteboardHints.some((re) => re.test(normalized))) return false;

  const offTopicHints = [
    /\b(weather|temperature|forecast)\b/,
    /\b(stock|stocks|crypto|bitcoin)\b/,
    /\b(news|headlines)\b/,
    /\b(recipe|cook)\b/,
    /\b(joke|poem|story|essay)\b/,
    /\b(email|write an email)\b/,
    /\b(set an alarm|timer|reminder)\b/,
  ];

  return offTopicHints.some((re) => re.test(normalized));
}

function synthesizeResponse(
  toolCallsTrace: Array<{ name: string; result: string; isError: boolean }>,
): string {
  if (toolCallsTrace.length === 0) return "Done.";
  const errors = toolCallsTrace.filter((t) => t.isError);
  const successes = toolCallsTrace
    .filter((t) => !t.isError && t.name !== "getBoardState")
    .map((t) => t.result);
  const errorMsgs = errors.map((e) => e.result);
  const parts: string[] = [];
  if (successes.length) parts.push(successes.join(". "));
  if (errorMsgs.length) parts.push(errorMsgs.join("; "));
  const text = parts.join(". ");
  if (!text) return "Done.";
  if (text.startsWith("{") || text.startsWith("[")) {
    return errors.length
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

  const { boardId, command, messages, debug: debugMode, viewportCenter } = body;
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

  const rateLimitKey = `${user.id}:${boardId}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (rateLimit.limited) {
    return NextResponse.json(
      {
        error:
          "Too many AI requests. Please wait a few seconds and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 1),
        },
      },
    );
  }

  if (isLikelyOffTopic(lastUserContent)) {
    return new Response(
      "I can only help with whiteboard commands on this board. Ask me to create, move, arrange, or find items.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  let responseMeta: {
    findResults?: {
      matches: Array<{ id: string; preview: string }>;
      totalCount: number;
      offset: number;
      limit: number;
    };
  } = {};

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
  let createdEntitiesThisTurn = 0;

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log("[AI command] request started", { requestId });

  try {
    const callStart = Date.now();
    console.log("[AI command] LLM call #1 starting", { requestId });
    const completion = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }).chat.completions.create({
      model: "gpt-4.1-nano",
      messages: apiMessages,
      tools: AI_TOOLS,
      tool_choice: "auto",
      max_tokens: 512,
    });
    const openaiMs = Date.now() - callStart;
    console.log("[AI command] LLM call #1 done", { requestId, openaiMs, willSendOpenaiCallsMs: [openaiMs] });
    const choice = completion.choices[0];
    const msg = choice?.message;
    const toolNames = msg?.tool_calls?.map((tc) => tc.function?.name).filter(Boolean) ?? [];
    if (toolNames.length > 0) {
      console.log("[AI command] tool calls from LLM", { requestId, toolNames });
    }
    if (!msg) {
      const text = "Something went wrong. Please try again.";
      return debugMode
        ? NextResponse.json({ text, debug: { error: "empty completion" } })
        : new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (!msg.tool_calls?.length) {
      const text = (msg.content ?? "").trim() || "Done.";
      const totalMs = Date.now() - t0;
      if (debugMode) {
        const openaiCallsMs = [openaiMs];
        console.log("[AI command] returning debug (no tool_calls)", { requestId, openaiCallsMs });
        return NextResponse.json({
          text,
          findResults: responseMeta.findResults,
          debug: {
            perf: {
              totalMs,
              authMs,
              openaiCallsMs,
              _debugNote: "1 LLM call per request",
            },
            toolCalls: toolCallsTrace,
          },
        });
      }
      if (responseMeta.findResults) {
        return NextResponse.json({
          text,
          findResults: responseMeta.findResults,
        });
      }
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const setupStart = Date.now();
    const [objects, channel] = await Promise.all([
      loadObjects(supabase, boardId),
      (async () => {
        const ch = supabase.channel(`board_objects:${boardId}`, {
          config: { broadcast: { self: false } },
        });
        await ch.subscribe();
        return ch;
      })(),
    ]);
    const setupMs = Date.now() - setupStart;

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
      setResponseMeta: (meta: typeof responseMeta) => {
        responseMeta = { ...responseMeta, ...meta };
      },
    };
    const ctxRef = { current: { ...baseCtx, objects } };
    const execCtx = {
      ctx: ctxRef.current,
      currentUserId: user.id,
      setResponseMeta: baseCtx.setResponseMeta,
      viewportCenter: viewportCenter ?? undefined,
    };

    if (toolNames.length > 0) {
      console.log("[AI command] setup after LLM", { setupMs });
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function?.name ?? "unknown";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
      } catch {}

      const toolStart = Date.now();
      const estimated = estimateCreatedEntities(name, args);
      if (
        estimated > 0 &&
        createdEntitiesThisTurn + estimated > MAX_CREATED_ENTITIES
      ) {
        const remaining = Math.max(0, MAX_CREATED_ENTITIES - createdEntitiesThisTurn);
        const result =
          remaining === 0
            ? `Error: Creation limit reached (max ${MAX_CREATED_ENTITIES} per request).`
            : `Error: Would create ${estimated}, but only ${remaining} remaining (limit ${MAX_CREATED_ENTITIES}).`;
        toolCallsTrace.push({
          name,
          args,
          result: result.slice(0, 500),
          isError: true,
          ms: Date.now() - toolStart,
        });
        continue;
      }

      let result: string;
      try {
        result = await executeAITool(name, args, execCtx);
        createdEntitiesThisTurn += estimated;
      } catch (err) {
        result = err instanceof Error ? err.message : String(err);
      }
      const toolMs = Date.now() - toolStart;

      toolCallsTrace.push({
        name,
        args,
        result: result.slice(0, 500),
        isError: result.startsWith("Error:"),
        ms: toolMs,
      });
    }

    const text = synthesizeResponse(toolCallsTrace);
    const totalMs = Date.now() - t0;

    if (debugMode) {
      const openaiCallsMs = [openaiMs];
      console.log("[AI command] returning debug response", {
        requestId,
        openaiCallsMs,
        llmCallCount: 1,
        toolCallsCount: toolCallsTrace.length,
      });
      return NextResponse.json({
        text,
        findResults: responseMeta.findResults,
        debug: {
          perf: {
            totalMs,
            authMs,
            openaiCallsMs,
            setupMs,
            _debugNote: "openaiCallsMs = [single LLM call ms]; 1 call per request",
          },
          toolCalls: toolCallsTrace,
        },
      });
    }

    if (responseMeta.findResults) {
      return NextResponse.json({
        text,
        findResults: responseMeta.findResults,
      });
    }

    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[AI command] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
