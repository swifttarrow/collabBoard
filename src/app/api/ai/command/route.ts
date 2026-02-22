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

CRITICAL: Call tools immediately. Never say "I will" or "Executing now" or "Let me"—just call the tool. If you output text instead of calling a tool, nothing happens. The user only sees tool results.

RULES:
- Always use tools. Keep replies brief. NEVER claim to have done something without calling the tool.
- Single LLM turn: Call all needed tools in one response. Do not expect another turn.
- Never output markdown, code blocks, or raw JSON. Use natural language only.
- If the request is unclear or ambiguous, ask for clarification. If you cannot complete it, say so.
- Only manipulate objects on this board via the provided tools. You cannot do anything else.

Creation:
- 1 sticky: createStickyNote. 2+ stickies: createBulkStickies with stickies array and optional layoutPlan (cols, rows, spacing, startX, startY).
- createShape for rect/circle, createFrame for bare frame (no label). createLabeledFrame for "a frame called X" or any named frame (Sprint Planning, Backlog, Ideas)—pass label.
- Templates: createSWOT for SWOT. createUserJourneyMap with columnCount. createRetroBoard ONLY when user explicitly wants retrospective (What Went Well, What Didn't, Action Items)—never for "Sprint Planning" or other named frames. createFlowDiagram: linear flows use steps array; branching (decisions, yes/no, multiple paths) use nodes (id, text) and edges (from, to). For COMPLEX topics (operating systems, decision trees, processes): be COMPREHENSIVE—include 12–25+ nodes. Do NOT oversimplify.
- Primitives: createAxis, createColumn, createRow, createQuadrants (2x2 grid, optional labels), createTable. Use centerX, centerY when viewport-centered.
- Max 100 entities per creation. New items get viewport focus automatically.

Manipulation: moveIntoFrame for 'move X into frame Y'. findFilters:[{type:'sticky', color:'yellow'}, {type:'rect', color:'blue'}], frameLabel:'Sprint Planning'. moveRelative for 'move X above/below Y'. moveAll(template) for 'move all to the right/left'. resizeFrameToFitContents for 'resize frame to fit contents'. changeColor(color, findFirst: {type:'sticky'}) when objectId unknown. resizeObject, updateText.

Layout: arrangeInGrid(layout, findFilter). 'arrange yellow stickies in 2x2' → layout:grid, cols:2, findFilter:{type:'sticky', color:'yellow'}. 'arrange four stickies in a vertical line' → layout:vertical. 'arrange horizontally' → layout:horizontal. 'arrange diagonally' → layout:diagonal. Do NOT use findObjects for arranging.

Find: findObjects(query) searches TEXT content of stickies (e.g. query "budget" = stickies containing "budget"). Does NOT filter by type or color. NEVER use findObjects for 'arrange stickies' or 'arrange yellow stickies'—use arrangeInGrid instead.

View: calculateCenter(objectIds|findFilter) returns center x,y. zoomTo(x, y, minZoom?, maxZoom?) pans to center point, clamps zoom (default 50-100%). zoomViewport, panViewport, frameViewportToContent.

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

/** User is asking for a complex flow diagram (decision tree, OS, process). Use gpt-4.1-mini for better detail. */
function isComplexFlowDiagramIntent(userContent: string): boolean {
  const n = userContent.trim().toLowerCase();
  const flowHints = [/\bflow\b/, /\bflowchart\b/, /\bdiagram\b/, /\bdecision\s*tree\b/, /\bprocess\b/];
  const complexTopicHints = [
    /\boperating\s*system\b/, /\bdecision\s*tree\b/, /\bworkflow\b/, /\bstate\s*machine\b/,
    /\bapproval\s*process\b/, /\bonboarding\b/, /\bdeployment\b/,
    /\bauthentication\b/, /\bauth\s*flow\b/, /\bpermissions\b/,
    /\bmodel\w*\s+(an?\s+)?\w+/,  // "modeling an OS", "model a process"
  ];
  const hasFlowIntent = flowHints.some((re) => re.test(n));
  const hasComplexTopic = complexTopicHints.some((re) => re.test(n));
  return hasFlowIntent && (hasComplexTopic || /\bcomprehensive\b|\bdetailed\b|\bfull\b|\bcomplete\b/i.test(n));
}

/** User wants to move objects into a frame. Use to force moveIntoFrame. */
function isMoveIntoFrameIntent(userContent: string): boolean {
  const n = userContent.trim().toLowerCase();
  return (
    (/\bmove\b/i.test(n) || /\bput\b/i.test(n)) &&
    /\binto\b/i.test(n) &&
    /\b(frame|sprint|planning|backlog|ideas)\b/i.test(n)
  );
}

/** Infer findFilters from user text when LLM omits them. E.g. "yellow sticky and blue rectangle" → [{type:'sticky', color:'yellow'}, {type:'rect', color:'blue'}]. */
function inferMoveIntoFrameFindFilters(userContent: string): Array<{ type: string; color: string }> | null {
  const text = userContent.trim().toLowerCase();
  const filters: Array<{ type: string; color: string }> = [];
  const colors = ["yellow", "blue", "red", "green", "pink", "orange", "purple", "cyan", "mint", "coral", "slate", "fuchsia", "peach"];
  // Match "color type" or "type color" (e.g. "yellow sticky", "blue rectangle")
  const colorTypeRe = new RegExp(
    `\\b(${colors.join("|")})\\s+(sticky|stickies|rectangle|rect|circle)\\b|\\b(sticky|stickies|rectangle|rect|circle)\\s+(${colors.join("|")})\\b`,
    "gi"
  );
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = colorTypeRe.exec(text)) !== null) {
    const color = (m[1] ?? m[4] ?? "").toLowerCase();
    const typeRaw = (m[2] ?? m[3] ?? "").toLowerCase();
    const type = typeRaw === "stickies" ? "sticky" : typeRaw === "rectangle" ? "rect" : typeRaw;
    const key = `${type}:${color}`;
    if (!seen.has(key)) {
      seen.add(key);
      filters.push({ type, color });
    }
  }
  return filters.length > 0 ? filters : null;
}

/** User wants to move one group relative to another (e.g. move X above Y). Use to force moveRelative. */
function isMoveRelativeIntent(userContent: string): boolean {
  const n = userContent.trim().toLowerCase();
  const hasMove = /\bmove\b/i.test(n) || /\bput\b/i.test(n) || /\bplace\b/i.test(n);
  const hasRelative =
    /\b(above|below|beneath|under|over)\b/i.test(n) ||
    /\b(to\s+the\s+)?(left|right)\s+of\b/i.test(n) ||
    /\b(next\s+to|beside)\b/i.test(n);
  return hasMove && hasRelative;
}

/** User wants to arrange objects in a grid or line. Use to force arrangeInGrid tool. */
function isArrangeInGridIntent(userContent: string): boolean {
  const n = userContent.trim().toLowerCase();
  const hasArrange = /\barrange\b/i.test(n);
  const hasGrid = /\bgrid\b/i.test(n);
  const hasLine =
    /\b(vertical|horizontal)\s+line\b/i.test(n) ||
    /\bin\s+a\s+(vertical|horizontal)\s+line\b/i.test(n) ||
    /\bin\s+a\s+(row|column)\b/i.test(n) ||
    /\b(horizontally|diagonally)\b/i.test(n);
  return hasArrange && (hasGrid || hasLine);
}

/** True if user's prompt explicitly mentions coordinates. */
function userSuppliedCoordinates(userContent: string): boolean {
  const norm = userContent.trim().toLowerCase();
  return (
    /\d+\s*,\s*\d+/.test(norm) ||
    /\b(position|coordinates?|at\s*\(|x\s*=\s*\d|y\s*=\s*\d|place\s+at)\b/i.test(norm)
  );
}

/** Strip entity IDs and coordinates from tool results for user-facing response. */
function sanitizeForUser(text: string, userContent: string): string {
  let out = text;
  out = out.replace(/\s*\.?\s*Id:\s*[a-f0-9-]{36}/gi, "");
  out = out.replace(/\s*\.?\s*Ids?:\s*[a-f0-9-,\s]+(\.{3})?/gi, "");
  out = out.replace(/\s*\.?\s*Slugs?:\s*[^.]+/gi, "");
  out = out.replace(/\s+of\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "");
  out = out.replace(/\s+from\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\s+to\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, " between two objects");
  out = out.replace(/\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "");
  if (!userSuppliedCoordinates(userContent)) {
    out = out.replace(/\s+at\s+\([^)]+\)/g, "");
    out = out.replace(/\s+from\s+\([^)]+\)\s+to\s+\([^)]+\)/g, "");
    out = out.replace(/\s+to\s+\([^)]+\)(?=\s|$|\.)/g, "");
    out = out.replace(/\s+Panned\s+by\s+\([^)]+\)\.?/g, ".");
  }
  return out.replace(/\s*\.\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
}

const ACTION_TOOLS = new Set([
  "moveRelative",
  "moveIntoFrame",
  "moveAll",
  "moveObject",
  "resizeFrameToFitContents",
  "resizeObject",
  "updateText",
  "changeColor",
  "arrangeInGrid",
  "spaceEvenly",
  "createStickyNote",
  "createBulkStickies",
  "createShape",
  "createFrame",
  "createText",
  "createLabeledFrame",
  "createColumn",
  "createRow",
  "createQuadrants",
  "createTable",
  "createSWOT",
  "createUserJourneyMap",
  "createRetroBoard",
  "createFlowDiagram",
  "createConnector",
  "createLine",
  "deleteObject",
  "deleteObjects",
  "clearBoard",
  "calculateCenter",
  "zoomTo",
  "frameViewportToContent",
]);

function synthesizeResponse(
  toolCallsTrace: Array<{ name: string; result: string; isError: boolean }>,
  lastUserContent: string,
): string {
  if (toolCallsTrace.length === 0) return "Done.";
  const errors = toolCallsTrace.filter((t) => t.isError);
  const successes = toolCallsTrace
    .filter((t) => !t.isError && t.name !== "getBoardState")
    .map((t) => t.result);
  const actionCalls = toolCallsTrace.filter((t) => ACTION_TOOLS.has(t.name));
  const actionSucceeded = actionCalls.some((t) => !t.isError);
  const errorMsgs = errors.map((e) => e.result);
  const parts: string[] = [];
  if (successes.length) parts.push(successes.join(". "));
  if (errorMsgs.length) parts.push(errorMsgs.join("; "));
  const text = parts.join(". ");

  if (!actionSucceeded && actionCalls.length === 0) {
    const toolsCalled = toolCallsTrace.map((t) => t.name);
    console.log("[AI command] no action tools called", {
      toolsCalled,
      toolCallsTrace: toolCallsTrace.map((t) => ({ name: t.name, isError: t.isError, result: t.result?.slice(0, 80) })),
    });
    return "I looked at the board but didn't move or change anything. Try 'move all to the right' or 'arrange in a grid'.";
  }
  if (!text) {
    if (errors.length)
      return `Something went wrong: ${errorMsgs.join("; ")}`;
    return "I looked at the board but didn't change anything. If you wanted to move or arrange items, try being more specific (e.g. 'arrange in a grid' or 'move the sticky right').";
  }
  if (text.startsWith("{") || text.startsWith("[")) {
    return errors.length
      ? `Something went wrong: ${errorMsgs.join("; ")}`
      : "Something went wrong. Please try again.";
  }
  return sanitizeForUser(text, lastUserContent) || "Done.";
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
  console.log("[AI command] request started", {
    requestId,
    viewportCenter: viewportCenter ?? "(not provided)",
    lastUserContentPreview: lastUserContent.slice(0, 60),
  });

  const forceMoveIntoFrame = isMoveIntoFrameIntent(lastUserContent);
  const forceMoveRelative = !forceMoveIntoFrame && isMoveRelativeIntent(lastUserContent);
  const forceArrangeInGrid = !forceMoveIntoFrame && !forceMoveRelative && isArrangeInGridIntent(lastUserContent);
  const useMiniForComplexFlow = isComplexFlowDiagramIntent(lastUserContent);
  const model = useMiniForComplexFlow ? "gpt-4.1-mini" : "gpt-4.1-nano";
  const toolChoice = forceMoveIntoFrame
    ? ({ type: "function" as const, function: { name: "moveIntoFrame" } })
    : forceMoveRelative
      ? ({ type: "function" as const, function: { name: "moveRelative" } })
      : forceArrangeInGrid
      ? ({ type: "function" as const, function: { name: "arrangeInGrid" } })
      : "required";

  try {
    const callStart = Date.now();
    console.log("[AI command] LLM call #1 starting", {
      requestId,
      model,
      forceMoveIntoFrame,
      forceMoveRelative,
      forceArrangeInGrid,
      toolChoice,
    });
    const completion = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }).chat.completions.create({
      model,
      messages: apiMessages,
      tools: AI_TOOLS,
      tool_choice: toolChoice,
      max_tokens: 2048,
    });
    const openaiMs = Date.now() - callStart;
    console.log("[AI command] LLM call #1 done", { requestId, openaiMs, willSendOpenaiCallsMs: [openaiMs] });
    const choice = completion.choices[0];
    const msg = choice?.message;
    const toolNames = msg?.tool_calls?.map((tc) => tc.function?.name).filter(Boolean) ?? [];
    const toolCallsWithArgs =
      msg?.tool_calls?.map((tc) => ({
        name: tc.function?.name,
        args: (() => {
          try {
            return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
          } catch {
            return {};
          }
        })(),
      })) ?? [];
    if (toolNames.length > 0) {
      console.log("[AI command] tool calls from LLM", {
        requestId,
        toolNames,
        toolCallsWithArgs,
        moveIntoFrameArgs: toolCallsWithArgs.find((t) => t.name === "moveIntoFrame")?.args,
        hasArrangeInGrid: toolNames.includes("arrangeInGrid"),
        arrangeInGridArgs: toolCallsWithArgs.find((t) => t.name === "arrangeInGrid")?.args,
      });
    } else {
      console.log("[AI command] no tool calls from LLM (tool_choice=required should prevent this)", {
        requestId,
        msgContent: msg?.content?.slice(0, 100),
      });
    }
    if (!msg) {
      const text = "Something went wrong. Please try again.";
      return debugMode
        ? NextResponse.json({ text, debug: { error: "empty completion" } })
        : new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (!msg.tool_calls?.length) {
      const raw = (msg.content ?? "").trim();
      const soundsLikeIntentToAct = /\b(I will|I'll|Executing|Let me|I'm going to|I'll go ahead)\b/i.test(raw);
      const text = soundsLikeIntentToAct
        ? "I didn't make any changes—I need to call the tools to do that. Please try again."
        : raw || "I'm not able to satisfy that request. Ask me what I can do or try something else.";
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

      // When moveIntoFrame is forced, infer missing args from user text
      if (name === "moveIntoFrame" && forceMoveIntoFrame) {
        console.log("[AI command] moveIntoFrame args BEFORE augmentation", {
          findFilters: (args as { findFilters?: unknown }).findFilters,
          frameLabel: (args as { frameLabel?: string }).frameLabel,
        });
        const mifArgs = args as { findFilters?: unknown[]; frameLabel?: string };
        const hasFindFilters =
          Array.isArray(mifArgs.findFilters) &&
          mifArgs.findFilters.some(
            (f: unknown) =>
              f &&
              typeof f === "object" &&
              ((f as { type?: string }).type || (f as { color?: string }).color)
          );
        if (!hasFindFilters) {
          const inferred = inferMoveIntoFrameFindFilters(lastUserContent);
          if (inferred) {
            args = { ...args, findFilters: inferred };
            console.log("[AI command] augmented moveIntoFrame findFilters from user text", {
              inferred,
            });
          } else {
            console.log("[AI command] could not infer findFilters from user text", {
              lastUserContent: lastUserContent.slice(0, 100),
            });
          }
        }
        if (!mifArgs.frameLabel) {
          const frameMatch = lastUserContent.match(/"([^"]+)"/) ||
            lastUserContent.match(/\b(Sprint Planning|Backlog|Ideas|To Do|Done)\b/i);
          if (frameMatch) {
            args = { ...args, frameLabel: frameMatch[1] };
            console.log("[AI command] augmented moveIntoFrame frameLabel from user text", {
              frameLabel: frameMatch[1],
            });
          } else {
            console.log("[AI command] could not infer frameLabel from user text", {
              lastUserContent: lastUserContent.slice(0, 100),
            });
          }
        }
        console.log("[AI command] moveIntoFrame args AFTER augmentation", {
          findFilters: (args as { findFilters?: unknown }).findFilters,
          frameLabel: (args as { frameLabel?: string }).frameLabel,
        });
      }

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

      if (name === "arrangeInGrid") {
        console.log("[AI command] arrangeInGrid executed", {
          args,
          result: result.slice(0, 200),
          isError: result.startsWith("Error:"),
          ms: toolMs,
        });
      }

      toolCallsTrace.push({
        name,
        args,
        result: result.slice(0, 500),
        isError: result.startsWith("Error:"),
        ms: toolMs,
      });
    }

    const text = synthesizeResponse(toolCallsTrace, lastUserContent);
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
