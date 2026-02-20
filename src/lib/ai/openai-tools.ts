/**
 * OpenAI-compatible tool definitions (JSON Schema) and executor.
 * Used for direct OpenAI API calls without Vercel AI SDK.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolContext } from "./tools/types";
import type OpenAI from "openai";
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
} from "./tools";

const SUPPORTED_COMMANDS = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify/categorize stickies into groups
• Follow a user: sync your view to theirs (e.g. "follow Jane", "watch John")`;

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getSupportedCommands",
      description: "ONLY use for informational queries: 'what can you do', 'help', 'commands', 'capabilities'. Returns the list of supported commands.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getBoardState",
      description: "Get the full board state: all objects with id, type, text, x, y, width, height, color. Use for connectors, move, delete, classify.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getStickyCount",
      description: "Get the count of stickies on the board. Returns { stickyCount }.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "createManyStickies",
      description: "Create a large number of stickies (25–100) in one shot. Use when user asks for 25+ stickies.",
      parameters: {
        type: "object",
        properties: {
          totalCount: { type: "number", description: "Total number of stickies to create" },
          topic: { type: "string", description: "Topic or theme for the stickies" },
          color: { type: "string", description: "Optional color for all stickies" },
        },
        required: ["totalCount", "topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createStickyNote",
      description: "Create a single sticky note.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          color: { type: "string" },
        },
        required: ["text", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createStickies",
      description: "Create 2–24 stickies at once, arranged in a 3-column grid.",
      parameters: {
        type: "object",
        properties: {
          stickies: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, color: { type: "string" } },
              required: ["text"],
            },
          },
          startX: { type: "number" },
          startY: { type: "number" },
        },
        required: ["stickies"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createShape",
      description: "Create a rectangle or circle shape.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["rect", "circle"] },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          color: { type: "string" },
        },
        required: ["type", "x", "y", "width", "height"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createFrame",
      description: "Create a frame (container) for grouping.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["title", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createText",
      description: "Create a text label.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" }, x: { type: "number" }, y: { type: "number" } },
        required: ["text", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createShapesAndConnect",
      description: "Create two shapes and connect them with a connector in ONE call.",
      parameters: {
        type: "object",
        properties: {
          type1: { type: "string", enum: ["rect", "circle"] },
          type2: { type: "string", enum: ["rect", "circle"] },
          x1: { type: "number" },
          y1: { type: "number" },
          x2: { type: "number" },
          y2: { type: "number" },
          connectorStyle: { type: "string", enum: ["both", "left", "right", "none"] },
        },
        required: ["type1", "type2", "x1", "y1", "x2", "y2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createConnector",
      description: "Create a connector between two EXISTING objects.",
      parameters: {
        type: "object",
        properties: {
          fromId: { type: "string" },
          toId: { type: "string" },
          style: { type: "string", enum: ["both", "left", "right", "none"] },
        },
        required: ["fromId", "toId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveObject",
      description: "Move an object to new x,y. Optionally set parentId to move into a frame.",
      parameters: {
        type: "object",
        properties: {
          objectId: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          parentId: { type: ["string", "null"] },
        },
        required: ["objectId", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resizeObject",
      description: "Resize an object.",
      parameters: {
        type: "object",
        properties: { objectId: { type: "string" }, width: { type: "number" }, height: { type: "number" } },
        required: ["objectId", "width", "height"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateText",
      description: "Update the text of an object.",
      parameters: {
        type: "object",
        properties: { objectId: { type: "string" }, newText: { type: "string" } },
        required: ["objectId", "newText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "changeColor",
      description: "Change object color.",
      parameters: {
        type: "object",
        properties: { objectId: { type: "string" }, color: { type: "string" } },
        required: ["objectId", "color"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteObject",
      description: "Delete a single object.",
      parameters: {
        type: "object",
        properties: { objectId: { type: "string" } },
        required: ["objectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteObjects",
      description: "Delete objects by id. Max 25 per call. For 'clear board' call repeatedly with remaining ids.",
      parameters: {
        type: "object",
        properties: {
          objectIds: { type: "array", items: { type: "string" } },
        },
        required: ["objectIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "classifyStickies",
      description: "Classify stickies into categories. Call getBoardState first to get sticky ids.",
      parameters: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                stickyIds: { type: "array", items: { type: "string" } },
              },
              required: ["name", "stickyIds"],
            },
          },
          startX: { type: "number" },
          startY: { type: "number" },
        },
        required: ["categories"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "followUser",
      description: "Follow another user on the board.",
      parameters: {
        type: "object",
        properties: { displayNameOrId: { type: "string" } },
        required: ["displayNameOrId"],
      },
    },
  },
];

export type ToolExecutorContext = {
  ctx: ToolContext;
  openai: OpenAI;
  currentUserId: string;
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  execCtx: ToolExecutorContext,
): Promise<string> {
  const { ctx, openai, currentUserId } = execCtx;

  switch (name) {
    case "getSupportedCommands":
      return SUPPORTED_COMMANDS;
    case "getBoardState":
      return getBoardState(ctx);
    case "getStickyCount":
      return getStickyCount(ctx);
    case "createManyStickies":
      return createManyStickies(ctx, openai, args as { totalCount: number; topic: string; color?: string });
    case "createStickyNote":
      return createStickyNote(ctx, args as { text: string; x: number; y: number; color?: string });
    case "createStickies":
      return createStickies(ctx, args as { stickies: Array<{ text: string; color?: string }>; startX?: number; startY?: number });
    case "createShape":
      return createShape(ctx, args as { type: "rect" | "circle"; x: number; y: number; width: number; height: number; color?: string });
    case "createFrame":
      return createFrame(ctx, args as { title: string; x: number; y: number; width?: number; height?: number });
    case "createText":
      return createText(ctx, args as { text: string; x: number; y: number });
    case "createShapesAndConnect":
      return createShapesAndConnect(ctx, {
        type1: (args as { type1: string }).type1 as "rect" | "circle",
        type2: (args as { type2: string }).type2 as "rect" | "circle",
        x1: (args as { x1: number }).x1,
        y1: (args as { y1: number }).y1,
        x2: (args as { x2: number }).x2,
        y2: (args as { y2: number }).y2,
        connectorStyle: (args as { connectorStyle?: string }).connectorStyle as "both" | "left" | "right" | "none" | undefined,
      });
    case "createConnector":
      return createConnector(ctx, {
        fromId: (args as { fromId: string }).fromId,
        toId: (args as { toId: string }).toId,
        style: (args as { style?: string }).style as "both" | "left" | "right" | "none" | undefined,
      });
    case "moveObject":
      return moveObject(ctx, {
        objectId: (args as { objectId: string }).objectId,
        x: (args as { x: number }).x,
        y: (args as { y: number }).y,
        parentId: (args as { parentId?: string | null }).parentId ?? undefined,
      });
    case "resizeObject":
      return resizeObject(ctx, args as { objectId: string; width: number; height: number });
    case "updateText":
      return updateText(ctx, args as { objectId: string; newText: string });
    case "changeColor":
      return changeColor(ctx, args as { objectId: string; color: string });
    case "deleteObject":
      return deleteObject(ctx, args as { objectId: string });
    case "deleteObjects":
      return deleteObjects(ctx, {
        objectIds: Array.isArray((args as { objectIds: unknown }).objectIds)
          ? ((args as { objectIds: unknown[] }).objectIds as string[]).slice(0, 25)
          : [],
      });
    case "classifyStickies":
      return classifyStickies(ctx, args as { categories: Array<{ name: string; stickyIds: string[] }>; startX?: number; startY?: number });
    case "followUser": {
      const result = await followUser(
        { ...ctx, currentUserId } as ToolContext & { currentUserId: string },
        args as { displayNameOrId: string },
      );
      return result.success
        ? `Following ${result.displayName}.`
        : `Error: ${result.error}`;
    }
    default:
      return `Error: Unknown tool "${name}"`;
  }
}
