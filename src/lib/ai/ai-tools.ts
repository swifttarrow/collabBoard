/**
 * Slim AI tools - one LLM trip, gpt-4.1-nano, guard rails.
 * Categories: Creation, Manipulation, Layout, Find, View.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolContext } from "./tools/types";
import type OpenAI from "openai";
import { getBoardState } from "./tools/getBoardState";
import { createStickyNote } from "./tools/createStickyNote";
import { createBulkStickies } from "./tools/createBulkStickies";
import { createShape } from "./tools/createShape";
import { createFrame } from "./tools/createFrame";
import { moveObject } from "./tools/moveObject";
import { resizeObject } from "./tools/resizeObject";
import { updateText } from "./tools/updateText";
import { changeColor } from "./tools/changeColor";
import { arrangeInGrid } from "./tools/arrangeInGrid";
import { spaceEvenly } from "./tools/spaceEvenly";
import { findObjects } from "./tools/findObjects";
import { zoomViewport } from "./tools/zoomViewport";
import { panViewport } from "./tools/panViewport";
import { frameViewportToContent } from "./tools/frameViewportToContent";

const MAX_ENTITIES = 100;

export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getBoardState",
      description:
        "Get board state (objects with id, type, x, y, etc). Call ONLY before move, resize, arrange—never before createStickyNote, createShape, or createFrame.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "createStickyNote",
      description: "Create a single sticky. Use x=100,y=100 or pick coordinates. Do NOT call getBoardState first. Viewport will focus on the new sticky.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Sticky content" },
          x: { type: "number", description: "X position" },
          y: { type: "number", description: "Y position" },
          color: { type: "string", description: "Optional: yellow, blue, green, pink, etc." },
        },
        required: ["text", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createBulkStickies",
      description:
        "Create 2–100 stickies at once. Use layoutPlan for rows/cols/spacing. Viewport will focus on created items.",
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
          layoutPlan: {
            type: "object",
            properties: {
              cols: { type: "number" },
              rows: { type: "number" },
              spacing: { type: "number" },
              startX: { type: "number" },
              startY: { type: "number" },
            },
          },
        },
        required: ["stickies"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createShape",
      description: "Create a rectangle or circle. Viewport will focus on it.",
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
      description: "Create a frame (container). Viewport will focus on it.",
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
      name: "moveObject",
      description: "Move an object. Call getBoardState first for IDs.",
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
      description: "Resize an object. Use for 'resize frame to fit contents'.",
      parameters: {
        type: "object",
        properties: {
          objectId: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["objectId", "width", "height"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateText",
      description: "Update the text of a sticky, text, or frame.",
      parameters: {
        type: "object",
        properties: {
          objectId: { type: "string" },
          newText: { type: "string" },
        },
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
        properties: {
          objectId: { type: "string" },
          color: { type: "string" },
        },
        required: ["objectId", "color"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arrangeInGrid",
      description:
        "Arrange objects in a grid. Call getBoardState first.",
      parameters: {
        type: "object",
        properties: {
          objectIds: { type: "array", items: { type: "string" } },
          cols: { type: "number" },
          gap: { type: "number" },
          startX: { type: "number" },
          startY: { type: "number" },
        },
        required: ["objectIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spaceEvenly",
      description: "Space objects evenly in a row or column.",
      parameters: {
        type: "object",
        properties: {
          objectIds: { type: "array", items: { type: "string" } },
          direction: { type: "string", enum: ["horizontal", "vertical", "row", "col"] },
        },
        required: ["objectIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findObjects",
      description:
        "Find objects by text search. 1 match: focus viewport. 2+: list top 3 with links; use offset/limit for pagination when user says 'show more'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          offset: { type: "number", description: "For pagination, e.g. 3 for next 3" },
          limit: { type: "number", description: "Matches per page, default 3" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "zoomViewport",
      description: "Zoom in or out.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["in", "out"] },
          factor: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "panViewport",
      description: "Pan the view.",
      parameters: {
        type: "object",
        properties: {
          deltaX: { type: "number" },
          deltaY: { type: "number" },
        },
        required: ["deltaX", "deltaY"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "frameViewportToContent",
      description: "Zoom and pan to fit all content. Use for 'show everything', 'zoom to fit'.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export type AIToolExecutorContext = {
  ctx: ToolContext;
  currentUserId: string;
  setResponseMeta: (meta: { findResults?: { matches: Array<{ id: string; preview: string }>; totalCount: number; offset: number; limit: number } }) => void;
  /** When provided, creation tools place entities centered at this world point */
  viewportCenter?: { x: number; y: number };
};

function estimateCreatedEntities(name: string, args: Record<string, unknown>): number {
  switch (name) {
    case "createStickyNote":
    case "createShape":
    case "createFrame":
      return 1;
    case "createBulkStickies": {
      const arr = args.stickies as Array<unknown> | undefined;
      return Array.isArray(arr) ? Math.min(MAX_ENTITIES, arr.length) : 0;
    }
    default:
      return 0;
  }
}

export async function executeAITool(
  name: string,
  args: Record<string, unknown>,
  execCtx: AIToolExecutorContext
): Promise<string> {
  const { ctx, setResponseMeta, viewportCenter } = execCtx;

  const ctxWithMeta = { ...ctx, setResponseMeta };

  switch (name) {
    case "getBoardState":
      return getBoardState(ctxWithMeta);
    case "createStickyNote": {
      const params = args as { text: string; x: number; y: number; color?: string };
      const placeAtCenter = viewportCenter
        ? {
            viewportCenterX: viewportCenter.x,
            viewportCenterY: viewportCenter.y,
          }
        : undefined;
      return createStickyNote(ctxWithMeta, {
        ...params,
        placeAtCenter,
      });
    }
    case "createBulkStickies": {
      const stickies = (args.stickies as Array<{ text: string; color?: string }>) ?? [];
      const layoutPlan = args.layoutPlan as import("./tools/createBulkStickies").LayoutPlan | undefined;
      return createBulkStickies(ctxWithMeta, { stickies, layoutPlan });
    }
    case "createShape": {
      const shapeArgs = args as {
        type: "rect" | "circle";
        x: number;
        y: number;
        width: number;
        height: number;
        color?: string;
      };
      const shapeX = viewportCenter
        ? Math.round(viewportCenter.x - (shapeArgs.width ?? 220) / 2)
        : shapeArgs.x;
      const shapeY = viewportCenter
        ? Math.round(viewportCenter.y - (shapeArgs.height ?? 140) / 2)
        : shapeArgs.y;
      return createShape(ctxWithMeta, { ...shapeArgs, x: shapeX, y: shapeY });
    }
    case "createFrame": {
      const frameArgs = args as { title: string; x: number; y: number; width?: number; height?: number };
      const frameW = frameArgs.width ?? 320;
      const frameH = frameArgs.height ?? 200;
      const frameX = viewportCenter
        ? Math.round(viewportCenter.x - frameW / 2)
        : frameArgs.x;
      const frameY = viewportCenter
        ? Math.round(viewportCenter.y - frameH / 2)
        : frameArgs.y;
      return createFrame(ctxWithMeta, { ...frameArgs, x: frameX, y: frameY });
    }
    case "moveObject":
      return moveObject(ctxWithMeta, {
        objectId: (args as { objectId: string }).objectId,
        x: (args as { x: number }).x,
        y: (args as { y: number }).y,
        parentId: (args as { parentId?: string | null }).parentId ?? undefined,
      });
    case "resizeObject":
      return resizeObject(ctxWithMeta, args as { objectId: string; width: number; height: number });
    case "updateText":
      return updateText(ctxWithMeta, args as { objectId: string; newText: string });
    case "changeColor":
      return changeColor(ctxWithMeta, args as { objectId: string; color: string });
    case "arrangeInGrid":
      return arrangeInGrid(ctxWithMeta, {
        objectIds: Array.isArray((args as { objectIds: unknown }).objectIds) ? ((args as { objectIds: string[] }).objectIds) : [],
        cols: (args as { cols?: number }).cols,
        rows: (args as { rows?: number }).rows,
        gap: (args as { gap?: number }).gap,
        startX: (args as { startX?: number }).startX,
        startY: (args as { startY?: number }).startY,
      });
    case "spaceEvenly":
      return spaceEvenly(ctxWithMeta, {
        objectIds: Array.isArray((args as { objectIds: unknown }).objectIds) ? ((args as { objectIds: string[] }).objectIds) : [],
        direction: (args as { direction?: "horizontal" | "vertical" | "row" | "col" }).direction,
      });
    case "findObjects":
      return findObjects(ctxWithMeta, {
        query: (args as { query: string }).query,
        offset: (args as { offset?: number }).offset,
        limit: (args as { limit?: number }).limit,
      });
    case "zoomViewport":
      return zoomViewport(ctxWithMeta, args as { direction?: "in" | "out"; factor?: number });
    case "panViewport":
      return panViewport(ctxWithMeta, args as { deltaX: number; deltaY: number });
    case "frameViewportToContent":
      return frameViewportToContent(ctxWithMeta);
    default:
      return `Error: Unknown tool "${name}"`;
  }
}

export { estimateCreatedEntities };
