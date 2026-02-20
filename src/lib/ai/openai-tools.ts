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
  createLine,
  moveObject,
  resizeObject,
  updateText,
  changeColor,
  deleteObject,
  deleteObjects,
  clearBoard,
  classifyStickies,
  clusterStickies,
  clusterStickiesOnGrid,
  clusterStickiesOnGridWithAI,
  clusterStickiesByQuadrant,
  clusterStickiesByQuadrantWithAI,
  followUser,
  zoomViewport,
  panViewport,
  frameViewportToContent,
  findObjects,
} from "./tools";

const SUPPORTED_COMMANDS = `Supported commands:
• Create stickies: single or multiple in a grid (e.g. "add a yellow sticky", "create stickies about X")
• Create shapes: rectangles and circles
• Create frames: containers for grouping (e.g. "Create SWOT analysis" = 4 frames)
• Create text labels and connectors between objects
• Move, resize, recolor objects; update text
• Delete objects: single, multiple, or "remove all"
• Classify stickies: clusterStickiesOnGridWithAI (continuous 2D graph), clusterStickiesByQuadrantWithAI (four quadrants), clusterStickies (frames), classifyStickies
• Follow a user: sync your view to theirs (e.g. "follow Jane", "watch John")
• Zoom/pan viewport: zoomViewport (zoom in/out), panViewport (move view), frameViewportToContent (fit all)
• Find objects: findObjects with query—searches sticky/text/frame content. 1 match: selects and zooms; multiple: ask user to clarify; none: say no matches. NEVER respond with JSON for find—use natural language only.`;

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
      description: "Delete specific objects by id. Max 25 per call. For selective deletion only.",
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
      name: "clearBoard",
      description: "Delete ALL objects on the board. Use for 'remove all', 'clear board', 'delete all objects'. One call clears everything.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "classifyStickies",
      description: "Classify stickies into categories (simple layout, no frames). Call getBoardState first to get sticky ids.",
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
      name: "clusterStickies",
      description: "Cluster stickies into categories with frames. Each cluster gets a frame with bold title and stickies arranged with uniform spacing. Use for generic classification. Call getBoardState first.",
      parameters: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Cluster/category name" },
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
      name: "clusterStickiesOnGridWithAI",
      description: "Place ALL stickies on an x/y grid. Use when user wants to classify stickies on a 2D graph (e.g. time vs impact, effort vs value). The AI scores each sticky on both axes automatically. No need to call getBoardState first. Use after createManyStickies or when stickies already exist.",
      parameters: {
        type: "object",
        properties: {
          xAxisLabel: { type: "string", description: "Label for x axis (e.g. 'Time')" },
          yAxisLabel: { type: "string", description: "Label for y axis (e.g. 'Impact')" },
          xAxisDescription: { type: "string", description: "Optional: what the x axis represents for scoring" },
          yAxisDescription: { type: "string", description: "Optional: what the y axis represents for scoring" },
        },
        required: ["xAxisLabel", "yAxisLabel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clusterStickiesOnGrid",
      description: "Place stickies on an x/y grid when you already have scores. Each sticky needs stickyId, x, y. Call getBoardState first. Prefer clusterStickiesOnGridWithAI when scores are not provided.",
      parameters: {
        type: "object",
        properties: {
          xAxisLabel: { type: "string", description: "Label for the x axis" },
          yAxisLabel: { type: "string", description: "Label for the y axis" },
          placements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stickyId: { type: "string" },
                x: { type: "number", description: "X-axis score" },
                y: { type: "number", description: "Y-axis score" },
              },
              required: ["stickyId", "x", "y"],
            },
          },
          originX: { type: "number" },
          originY: { type: "number" },
          scale: { type: "number", description: "Pixels per unit (default 60)" },
        },
        required: ["xAxisLabel", "yAxisLabel", "placements"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clusterStickiesByQuadrantWithAI",
      description: "Place ALL stickies into four quadrants on a 2D graph. Use when user wants quadrants (e.g. 'classify into four quadrants', 'time vs impact quadrants'). The AI scores each sticky automatically. No need to call getBoardState first. Use after createManyStickies or when stickies already exist.",
      parameters: {
        type: "object",
        properties: {
          xAxisLabel: { type: "string", description: "Label for x axis (e.g. 'Time')" },
          yAxisLabel: { type: "string", description: "Label for y axis (e.g. 'Impact')" },
          xAxisDescription: { type: "string", description: "Optional: what the x axis represents" },
          yAxisDescription: { type: "string", description: "Optional: what the y axis represents" },
        },
        required: ["xAxisLabel", "yAxisLabel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clusterStickiesByQuadrant",
      description: "Place stickies into quadrants when you already have scores. Requires placements with xScore, yScore. Prefer clusterStickiesByQuadrantWithAI when scores are not provided.",
      parameters: {
        type: "object",
        properties: {
          xAxisLabel: { type: "string", description: "Label for the x axis" },
          yAxisLabel: { type: "string", description: "Label for the y axis" },
          placements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stickyId: { type: "string" },
                xScore: { type: "number" },
                yScore: { type: "number" },
              },
              required: ["stickyId", "xScore", "yScore"],
            },
          },
          originX: { type: "number" },
          originY: { type: "number" },
        },
        required: ["xAxisLabel", "yAxisLabel", "placements"],
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
  {
    type: "function",
    function: {
      name: "zoomViewport",
      description: "Zoom the view in or out. Use when user asks to zoom in, zoom out, etc.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["in", "out"], description: "Zoom direction" },
          factor: { type: "number", description: "Zoom factor: >1 zoom in, <1 zoom out (e.g. 1.25 or 0.8)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "panViewport",
      description: "Pan the view by pixels. Use when user asks to pan left/right/up/down.",
      parameters: {
        type: "object",
        properties: {
          deltaX: { type: "number", description: "Pixels to pan horizontally (positive = right)" },
          deltaY: { type: "number", description: "Pixels to pan vertically (positive = down)" },
        },
        required: ["deltaX", "deltaY"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "frameViewportToContent",
      description: "Zoom and pan to fit all board content in view. Use for 'zoom to fit', 'show everything', 'frame the board'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "findObjects",
      description: "Find objects by searching their text. 1 match: select, center, and zoom in. Multiple: ask user to clarify. None: say no matches. Use for 'find X', 'show me the sticky about Y', 'where is Z'.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search term (case-insensitive, matches sticky/text/frame content)" } },
        required: ["query"],
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
    case "clearBoard":
      return clearBoard(ctx);
    case "classifyStickies":
      return classifyStickies(ctx, args as { categories: Array<{ name: string; stickyIds: string[] }>; startX?: number; startY?: number });
    case "clusterStickies":
      return clusterStickies(ctx, args as { categories: Array<{ name: string; stickyIds: string[] }>; startX?: number; startY?: number });
    case "clusterStickiesOnGridWithAI":
      return clusterStickiesOnGridWithAI(
        ctx,
        openai,
        args as { xAxisLabel: string; yAxisLabel: string; xAxisDescription?: string; yAxisDescription?: string },
      );
    case "clusterStickiesOnGrid":
      return clusterStickiesOnGrid(ctx, args as { xAxisLabel: string; yAxisLabel: string; placements: Array<{ stickyId: string; x: number; y: number }>; originX?: number; originY?: number; scale?: number });
    case "clusterStickiesByQuadrantWithAI":
      return clusterStickiesByQuadrantWithAI(
        ctx,
        openai,
        args as { xAxisLabel: string; yAxisLabel: string; xAxisDescription?: string; yAxisDescription?: string },
      );
    case "clusterStickiesByQuadrant":
      return clusterStickiesByQuadrant(ctx, args as { xAxisLabel: string; yAxisLabel: string; placements: Array<{ stickyId: string; xScore: number; yScore: number }>; originX?: number; originY?: number });
    case "followUser": {
      const result = await followUser(
        { ...ctx, currentUserId } as ToolContext & { currentUserId: string },
        args as { displayNameOrId: string },
      );
      return result.success
        ? `Following ${result.displayName}.`
        : `Error: ${result.error}`;
    }
    case "zoomViewport":
      return zoomViewport(ctx, args as { direction?: "in" | "out"; factor?: number });
    case "panViewport":
      return panViewport(ctx, args as { deltaX: number; deltaY: number });
    case "frameViewportToContent":
      return frameViewportToContent(ctx);
    case "findObjects":
      return findObjects(ctx, args as { query: string });
    default:
      return `Error: Unknown tool "${name}"`;
  }
}
