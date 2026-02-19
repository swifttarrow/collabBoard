import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@ai-sdk/openai";
import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import { rowToObject } from "@/lib/board/sync";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import {
  getBoardState,
  createStickyNote,
  createStickies,
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
  type ToolContext,
} from "@/lib/ai/tools";

const BOARD_OBJECTS_EVENT = "board_objects";
const INPUT_SCHEMA = z.object({
  boardId: z.string().uuid(),
  command: z.string().min(1).max(2000),
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
      { error: "Invalid input. Expected { boardId, command }" },
      { status: 400 }
    );
  }

  const { boardId, command } = body;

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

  console.debug("[AI command] received", { boardId, command: command.slice(0, 150) });

  const { text: intentReply } = await generateText({
    model: openai("gpt-4o-mini"),
    maxTokens: 10,
    prompt: `Is the user asking what the assistant can do, what commands are supported, for help, capabilities, features, or options? Examples: "what can you do", "help", "what is possible?", "list your features". Reply with exactly YES or NO.

User said: "${command.trim()}"

Reply:`,
  });
  const isHelpQuery = /^\s*y(es)?\b/i.test(intentReply.trim());
  console.debug("[AI command] intent check", { intentReply: intentReply.trim(), isHelpQuery });
  if (isHelpQuery) {
    const supportedCommands = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups`;
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

  const baseCtx: Omit<ToolContext, "objects"> = {
    boardId,
    supabase,
    broadcast,
  };

  const contextRef: { current: ToolContext } = { current: { ...baseCtx, objects } };

  const SUPPORTED_COMMANDS = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups`;

  const createTools = () => ({
    getSupportedCommands: tool({
      description:
        "ONLY use for informational queries: 'what can you do', 'help', 'commands', 'capabilities', 'what do you support'. Returns the list of supported commands. Do NOT create stickies or any objects for these queries.",
      parameters: z.object({}),
      execute: async () => SUPPORTED_COMMANDS,
    }),
    getBoardState: tool({
      description:
        "Get the current board state: all objects with id, type, text, x, y, width, height, color. Use this to see existing objects before creating, moving, or connecting them.",
      parameters: z.object({}),
      execute: async () => getBoardState(contextRef.current),
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
        "Create multiple stickies at once, arranged in a 3-column grid. Use ONLY when the user explicitly asks to CREATE stickies with specific content (e.g. 'create stickies about X'). NEVER use for 'what can you do', 'help', or 'commands'—use getSupportedCommands instead.",
      parameters: z.object({
        stickies: z
          .array(
            z.object({
              text: z.string().describe("Content for this sticky (concise: title, bullet, or 1–2 sentences)"),
              color: z.string().optional(),
            })
          )
          .describe("Array of stickies to create; arranges in 3-column grid"),
        startX: z.number().optional().describe("Top-left x, default 80"),
        startY: z.number().optional().describe("Top-left y, default 80"),
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
  });

  const systemPrompt = `You are a whiteboard assistant. You MUST call tools to execute every command. You NEVER write essays, docs, or long text.

RULES:
- Always use tools. Your reply: 1-2 sentences max (e.g. "Done." or "Removed 5 objects.").
- EXCEPTION—getSupportedCommands: When the user asks "what can you do", "help", "commands", "capabilities"—call getSupportedCommands. Your reply MUST be the EXACT text returned by that tool. Output it verbatim; never reply with just "Done" or a summary.
- Never output markdown, code blocks, or documentation.
- For "remove all", "clear board", "delete all objects": call getBoardState, then deleteObjects with object ids (max 25 per call). If more than 25 objects, call deleteObjects again with remaining ids until done.
- Call getBoardState first before creating connectors, moving, or deleting (need object ids).
- For "create two shapes then connect them" (e.g. "create two circles, connect with double arrow"): ALWAYS use createShapesAndConnect in ONE call. Do NOT use createShape + createConnector separately.

For creating 2+ stickies: ALWAYS use createStickies (never createStickyNote in a loop). createStickies arranges them in a grid automatically. Split content into one idea per sticky. Never use createStickyNote repeatedly with similar coordinates—stickies would stack.

For "classify", "categorize", or "group" stickies: call getBoardState first, then classifyStickies with categories from sticky content.

Coordinates: x increases right, y increases down. Typical sticky ~180x120. To move objects into frames, use moveObject with parentId.

For "Create SWOT analysis": create 4 frames, add stickies inside each.

Respond with a brief summary only.`;

  try {
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: command,
      tools: createTools(),
      toolChoice: "auto",
      maxSteps: 5,
      maxTokens: 1024,
      onStepFinish: async ({ stepType, toolCalls }) => {
        console.debug("[AI command] step finished", {
          stepType,
          toolNames: toolCalls?.map((tc) => tc.toolName) ?? [],
        });
        // Refresh context for next step so tools see newly created objects
        const freshObjects = await loadObjects(supabase, boardId);
        contextRef.current = { ...baseCtx, objects: freshObjects };
      },
    });

    return result.toTextStreamResponse({
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
