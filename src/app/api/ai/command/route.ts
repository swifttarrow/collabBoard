import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@ai-sdk/openai";
import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import { rowToObject } from "@/lib/board/sync";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import {
  getBoardState,
  getStickyCount,
  createStickyNote,
  createStickies,
  createManyStickies,
  createShape,
  createShapesAndConnect,
  createFrame,
  createText,
  createConnector,
  moveObject,
  resizeObject,
  updateText,
  changeColor,
  deleteObject,
  deleteObjects,
  classifyStickies,
  followUser,
  type ToolContext,
} from "@/lib/ai/tools";

const BOARD_OBJECTS_EVENT = "board_objects";
const INPUT_SCHEMA = z.object({
  boardId: z.string().uuid(),
  command: z.string().min(1).max(2000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1)
    .max(50)
    .optional(),
}).refine((data) => data.command != null || (data.messages != null && data.messages.length > 0), {
  message: "Either command or messages must be provided",
});

async function loadObjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<Record<string, BoardObjectWithMeta>> {
  const { data: rows, error } = await supabase
    .from("board_objects")
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .eq("board_id", boardId)
    .order("updated_at", { ascending: true });

  if (error) return {};
  const objects: Record<string, BoardObjectWithMeta> = {};
  for (const row of rows ?? []) {
    const obj = rowToObject(row as Parameters<typeof rowToObject>[0]);
    objects[obj.id] = obj;
  }
  return objects;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof INPUT_SCHEMA>;
  try {
    body = INPUT_SCHEMA.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid input. Expected { boardId, command } or { boardId, messages }" },
      { status: 400 }
    );
  }

  const { boardId, command, messages } = body;
  const messagesList = messages ?? (command != null ? [{ role: "user" as const, content: command }] : []);
  const lastUserContent = messagesList.filter((m) => m.role === "user").pop()?.content ?? command ?? "";

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
  const lastAssistantContent = messagesList.filter((m) => m.role === "assistant").pop()?.content ?? "";
  console.log("[AI command] received", {
    boardId,
    messageCount: messagesList.length,
    isFollowUp,
    lastUser: lastUserContent.slice(0, 150),
    lastUserTrimmed: lastUserContent.trim().toLowerCase(),
    lastAssistantPreview: lastAssistantContent.slice(0, 100),
  });

  const { text: intentReply } = await generateText({
    model: openai("gpt-4o-mini"),
    maxTokens: 10,
    prompt: `Is the user asking what the assistant can do, what commands are supported, for help, capabilities, features, or options? Examples: "what can you do", "help", "what is possible?", "list your features". Reply with exactly YES or NO.

User said: "${lastUserContent.trim()}"

Reply:`,
  });
  const isHelpQuery = /^\s*y(es)?\b/i.test(intentReply.trim());
  console.log("[AI command] intent check", { intentReply: intentReply.trim(), isHelpQuery });
  if (isHelpQuery) {
    console.log("[AI command] returning early: classified as help query");
    const supportedCommands = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups
• Follow a user: sync your view to theirs (e.g. "follow Jane", "watch John")`;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(supportedCommands));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
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
      event: BOARD_OBJECTS_EVENT,
      payload,
    });
  };

  const baseCtx: Omit<ToolContext, "objects"> & { currentUserId: string } = {
    boardId,
    supabase,
    broadcast,
    currentUserId: user.id,
  };

  const contextRef: { current: ToolContext } = { current: { ...baseCtx, objects } };
  const model = openai("gpt-4o-mini");

  const SUPPORTED_COMMANDS = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups
• Follow a user: sync your view to theirs (e.g. "follow Jane", "watch John")`;

  const createTools = () => ({
    getSupportedCommands: tool({
      description:
        "ONLY use for informational queries: 'what can you do', 'help', 'commands', 'capabilities', 'what do you support'. Returns the list of supported commands. Do NOT create stickies or any objects for these queries.",
      parameters: z.object({}),
      execute: async () => SUPPORTED_COMMANDS,
    }),
    getBoardState: tool({
      description:
        "Get the full board state: all objects with id, type, text, x, y, width, height, color. Use for connectors, move, delete, classify. Returns large JSON when many objects exist—do NOT use for create-stickies flows; use getStickyCount instead.",
      parameters: z.object({}),
      execute: async () => getBoardState(contextRef.current),
    }),
    getStickyCount: tool({
      description:
        "Get the count of stickies on the board. Returns { stickyCount }. Use for connectors, delete, or when you need the current count.",
      parameters: z.object({}),
      execute: async () => getStickyCount(contextRef.current),
    }),
    createManyStickies: tool({
      description:
        "Create a large number of stickies (25–100) in one shot. Use when user asks for 25+ stickies (e.g. 'create 100 stickies about movie reviews'). The backend generates content and creates them in batches—no user confirmation needed. Prefer this over createStickies for 25+.",
      parameters: z.object({
        totalCount: z.number().int().min(25).max(100).describe("Total number of stickies to create"),
        topic: z.string().describe("Topic or theme for the stickies (e.g. 'movie reviews', 'agile principles')"),
        color: z.string().optional().describe("Optional color for all stickies, or leave empty to vary colors"),
      }),
      execute: async (p) => createManyStickies(contextRef.current, model, p),
    }),
    createStickyNote: tool({
      description:
        "Create a single sticky note. Use color names like yellow, blue, pink, green, or hex codes.",
      parameters: z.object({
        text: z.string().describe("Content of the sticky note"),
        x: z.number().describe("X position on canvas"),
        y: z.number().describe("Y position on canvas"),
        color: z.string().optional().describe("Color name or hex, e.g. yellow, blue, #FDE68A"),
      }),
      execute: async (p) => createStickyNote(contextRef.current, p),
    }),
    createStickies: tool({
      description:
        "Create 2–24 stickies at once, arranged in a 3-column grid. Use when user asks for a small number of stickies. For 25+ stickies, use createManyStickies instead.",
      parameters: z.object({
        stickies: z
          .array(
            z.object({
              text: z.string().describe("Content for this sticky (concise: title, bullet, or 1–2 sentences)"),
              color: z.string().optional(),
            })
          )
          .min(2)
          .max(24)
          .describe("Array of stickies to create (2–24)."),
        startX: z.number().optional().describe("Top-left x, default 80"),
        startY: z.number().optional().describe("Top-left y, default auto-placed below existing content"),
      }),
      execute: async (p) => createStickies(contextRef.current, p),
    }),
    createShape: tool({
      description: "Create a rectangle or circle shape",
      parameters: z.object({
        type: z.enum(["rect", "circle"]),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        color: z.string().optional(),
      }),
      execute: async (p) => createShape(contextRef.current, p),
    }),
    createFrame: tool({
      description:
        "Create a frame (container). Use for grouping or sections like Sprint Planning, SWOT analysis quadrants.",
      parameters: z.object({
        title: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      execute: async (p) => createFrame(contextRef.current, p),
    }),
    createText: tool({
      description: "Create a text label. Use for category headers, titles, etc.",
      parameters: z.object({
        text: z.string().describe("Label text"),
        x: z.number(),
        y: z.number(),
      }),
      execute: async (p) => createText(contextRef.current, p),
    }),
    createShapesAndConnect: tool({
      description:
        "Create two shapes (rect or circle) and connect them with a connector in ONE call. PREFER this for 'create two X then connect them' or 'create two circles and connect with arrow'. Use positions like x1=100,y1=200, x2=300,y2=200 for side-by-side. connectorStyle 'both' = double arrow.",
      parameters: z.object({
        type1: z.enum(["rect", "circle"]).describe("First shape type"),
        type2: z.enum(["rect", "circle"]).describe("Second shape type"),
        x1: z.number().describe("X of first shape"),
        y1: z.number().describe("Y of first shape"),
        x2: z.number().describe("X of second shape"),
        y2: z.number().describe("Y of second shape"),
        connectorStyle: z.enum(["both", "left", "right", "none"]).optional().describe("'both' = double arrow"),
      }),
      execute: async (p) =>
        createShapesAndConnect(contextRef.current, {
          type1: p.type1,
          type2: p.type2,
          x1: p.x1,
          y1: p.y1,
          x2: p.x2,
          y2: p.y2,
          connectorStyle: p.connectorStyle,
        }),
    }),
    createConnector: tool({
      description:
        "Create a connector between two EXISTING objects. Use when objects already exist. fromId and toId from getBoardState. Use style 'both' for double arrow.",
      parameters: z.object({
        fromId: z.string().describe("Source object id"),
        toId: z.string().describe("Target object id"),
        style: z.enum(["both", "left", "right", "none"]).optional().describe("Arrow style: both (arrows both ends), right (arrow at end), left, none"),
      }),
      execute: async (p) => createConnector(contextRef.current, { fromId: p.fromId, toId: p.toId, style: p.style }),
    }),
    moveObject: tool({
      description:
        "Move an object to new x,y. Optionally set parentId to move it into a frame (or null for board root). When parentId changes, position is auto-converted to the new parent's local coords.",
      parameters: z.object({
        objectId: z.string(),
        x: z.number(),
        y: z.number(),
        parentId: z.string().nullable().optional().describe("Frame id to move into, or null for board root"),
      }),
      execute: async (p) => moveObject(contextRef.current, p),
    }),
    resizeObject: tool({
      description: "Resize an object. Cannot resize lines.",
      parameters: z.object({
        objectId: z.string(),
        width: z.number(),
        height: z.number(),
      }),
      execute: async (p) => resizeObject(contextRef.current, p),
    }),
    updateText: tool({
      description: "Update the text of an object (sticky, text, or frame title)",
      parameters: z.object({
        objectId: z.string(),
        newText: z.string(),
      }),
      execute: async (p) => updateText(contextRef.current, p),
    }),
    changeColor: tool({
      description: "Change object color. Use names like yellow, blue, pink or hex.",
      parameters: z.object({
        objectId: z.string(),
        color: z.string(),
      }),
      execute: async (p) => changeColor(contextRef.current, p),
    }),
    deleteObject: tool({
      description: "Delete a single object from the board.",
      parameters: z.object({
        objectId: z.string().describe("ID of the object to delete"),
      }),
      execute: async (p) => deleteObject(contextRef.current, p),
    }),
    deleteObjects: tool({
      description:
        "Delete objects. Use for 'remove all' or 'clear board'. Pass object ids from getBoardState. Accepts any number of ids; only first 25 are deleted per call. If more than 25 objects exist, call again with remaining ids.",
      parameters: z.object({
        objectIds: z.preprocess(
          (val) => (Array.isArray(val) ? val.slice(0, 25) : val),
          z.array(z.string()).min(1).max(25)
        ).describe("Array of object ids to delete (first 25 processed per call)"),
      }),
      execute: async (p) => deleteObjects(contextRef.current, p),
    }),
    classifyStickies: tool({
      description:
        "Classify stickies into categories. Creates a text label for each category, then arranges stickies in a grid below each label with gaps. Categories are spaced apart. Call getBoardState first to get sticky ids and their text for determining categories.",
      parameters: z.object({
        categories: z
          .array(
            z.object({
              name: z.string().describe("Category label (e.g. 'High Priority')"),
              stickyIds: z
                .array(z.string())
                .describe("Ids of stickies in this category from getBoardState"),
            })
          )
          .describe(
            "Array of { name, stickyIds }. Each category gets a text header and stickies in a 3-column grid below."
          ),
        startX: z.number().optional().describe("Starting x position, default 80"),
        startY: z.number().optional().describe("Starting y position, default 80"),
      }),
      execute: async (p) => classifyStickies(contextRef.current, p),
    }),
    followUser: tool({
      description:
        "Follow another user on the board. Your viewport will sync to theirs until you pan or zoom. Use when user says 'follow X', 'follow [name]', 'watch X', etc. Only one user can be followed at a time. Cannot follow yourself.",
      parameters: z.object({
        displayNameOrId: z
          .string()
          .describe(
            "First name, last name, full name, or user id of the board member to follow"
          ),
      }),
      execute: async (p) =>
        followUser(
          contextRef.current as ToolContext & { currentUserId: string },
          p
        ),
    }),
  });

  const systemPrompt = `You are a whiteboard assistant. You MUST call tools to execute every command. You NEVER write essays, docs, or long text.

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

  console.log("[AI command] starting streamText", {
    messageCount: messagesList.length,
    lastUser: lastUserContent.slice(0, 100),
    objectCount: Object.keys(objects).length,
    stickyCount: Object.values(objects).filter((o) => (o as { type?: string }).type === "sticky").length,
  });
  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: messagesList.map((m) => ({ role: m.role, content: m.content })),
      tools: createTools(),
      toolChoice: "auto",
      maxSteps: 12,
      maxTokens: 2048,
      onStepFinish: async (stepResult) => {
        const { stepType, toolCalls, toolResults, finishReason, text } = stepResult;
        console.log("[AI command] onStepFinish", {
          stepType,
          finishReason,
          textLen: text?.length ?? 0,
          toolCallCount: toolCalls?.length ?? 0,
          toolNames: toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? [],
        });
        for (let i = 0; i < (toolCalls?.length ?? 0); i++) {
          const tc = toolCalls?.[i];
          if (tc) {
            const args = (tc as { args: unknown }).args;
            const argsStr = JSON.stringify(args ?? {});
            console.log("[AI command] toolCall", {
              name: (tc as { toolName: string }).toolName,
              argsFull: argsStr,
              stickiesLength: typeof args === "object" && args != null && "stickies" in args
                ? (Array.isArray((args as { stickies?: unknown[] }).stickies)
                    ? (args as { stickies: unknown[] }).stickies.length
                    : "N/A")
                : "N/A",
            });
          }
        }
        for (let i = 0; i < (toolResults?.length ?? 0); i++) {
          const tr = toolResults?.[i];
          if (tr) {
            const resultStr = String((tr as { result: unknown }).result ?? "");
            console.log("[AI command] toolResult", {
              resultPreview: resultStr.slice(0, 300),
              resultLength: resultStr.length,
            });
          }
        }
        const freshObjects = await loadObjects(supabase, boardId);
        contextRef.current = { ...baseCtx, objects: freshObjects };
      },
      onError: (err) => {
        console.error("[AI command] streamText onError:", err);
      },
      onFinish: (event) => {
        const toolsUsed = event.steps?.flatMap((s) => (s.toolCalls ?? []).map((tc: { toolName: string }) => tc.toolName)) ?? [];
        console.log("[AI command] onFinish", {
          text: event.text?.slice(0, 200),
          finishReason: event.finishReason,
          stepCount: event.steps?.length ?? 0,
          toolsUsed,
          createStickiesCalled: toolsUsed.filter((n) => n === "createStickies").length,
          getStickyCountCalled: toolsUsed.filter((n) => n === "getStickyCount").length,
        });
      },
    });

    // Filter out raw JSON from the stream so tool data doesn't appear in the chat
    let jsonBuffer = "";
    const filteredStream = result.textStream.pipeThrough(
      new TransformStream<string, string>({
        transform(chunk, controller) {
          let text = jsonBuffer + chunk;
          jsonBuffer = "";
          let out = "";
          let i = 0;
          while (i < text.length) {
            const start = text.indexOf("{", i);
            if (start === -1) {
              out += text.slice(i);
              break;
            }
            out += text.slice(i, start);
            let depth = 0;
            let j = start;
            for (; j < text.length; j++) {
              if (text[j] === "{") depth++;
              else if (text[j] === "}") {
                depth--;
                if (depth === 0) break;
              }
            }
            if (depth === 0) {
              i = j + 1;
            } else {
              jsonBuffer = text.slice(start);
              break;
            }
          }
          if (out) controller.enqueue(out);
        },
        flush(controller) {
          if (jsonBuffer) controller.enqueue(jsonBuffer);
        },
      })
    );

    return new Response(filteredStream.pipeThrough(new TextEncoderStream()), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[AI command] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
