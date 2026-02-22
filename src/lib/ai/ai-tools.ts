/**
 * Slim AI tools - one LLM trip, gpt-4.1-nano, guard rails.
 * Categories: Creation, Manipulation, Layout, Find, View.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolContext } from "./tools/types";
import { createStickyNote } from "./tools/createStickyNote";
import { createBulkStickies } from "./tools/createBulkStickies";
import { createShape } from "./tools/createShape";
import { computeFanOutPlacement } from "./viewport-placement";
import { createFrame } from "./tools/createFrame";
import { createText } from "./tools/createText";
import { createAxis } from "./tools/createAxis";
import { createLabeledFrame } from "./tools/createLabeledFrame";
import { createColumn } from "./tools/createColumn";
import { createRow } from "./tools/createRow";
import { createQuadrants } from "./tools/createQuadrants";
import { createTable } from "./tools/createTable";
import { createSWOT } from "./tools/createSWOT";
import { createUserJourneyMap } from "./tools/createUserJourneyMap";
import { createRetroBoard } from "./tools/createRetroBoard";
import { createFlowDiagram } from "./tools/createFlowDiagram";
import { moveObject } from "./tools/moveObject";
import { moveAll } from "./tools/moveAll";
import { moveRelative } from "./tools/moveRelative";
import { moveIntoFrame } from "./tools/moveIntoFrame";
import { resizeObject } from "./tools/resizeObject";
import { resizeFrameToFitContents } from "./tools/resizeFrameToFitContents";
import { updateText } from "./tools/updateText";
import { changeColor } from "./tools/changeColor";
import { arrangeInGrid } from "./tools/arrangeInGrid";
import { spaceEvenly } from "./tools/spaceEvenly";
import { findObjects } from "./tools/findObjects";
import { zoomViewport } from "./tools/zoomViewport";
import { panViewport } from "./tools/panViewport";
import { zoomTo } from "./tools/zoomTo";
import { calculateCenter } from "./tools/calculateCenter";
import { frameViewportToContent } from "./tools/frameViewportToContent";

const MAX_ENTITIES = 100;

type FindFilter = { type?: "sticky" | "rect" | "circle" | "frame" | "text"; color?: string };

export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "moveRelative",
      description:
        "Move one group RELATIVE to another. CRITICAL: 'Move A above B' → moveFilter=A, relativeToFilter=B. The FIRST thing mentioned is moveFilter (what we MOVE), the SECOND is relativeToFilter (reference). E.g. 'move SWOT above red stickies' → moveFilter:{type:'frame'}, relativeToFilter:{type:'sticky', color:'red'}, direction:'above'.",
      parameters: {
        type: "object",
        properties: {
          moveFilter: {
            type: "object",
            description: "The thing TO MOVE (first noun). 'Move SWOT above red stickies' → moveFilter=SWOT={type:'frame'}. Do NOT use the reference here.",
            properties: {
              type: { type: "string", enum: ["sticky", "text", "frame", "rect", "circle"] },
              color: { type: "string", description: "e.g. blue, yellow, red" },
            },
          },
          relativeToFilter: {
            type: "object",
            description: "The REFERENCE (second noun). 'Move SWOT above red stickies' → relativeToFilter=red stickies={type:'sticky', color:'red'}. Do NOT use the thing we're moving here.",
            properties: {
              type: { type: "string", enum: ["sticky", "text", "frame", "rect", "circle"] },
              color: { type: "string", description: "e.g. yellow, blue, red" },
            },
          },
          direction: {
            type: "string",
            enum: ["above", "below", "leftOf", "rightOf"],
            description: "Where to place move group relative to reference",
          },
          gap: { type: "number", description: "Spacing between groups, default 24" },
        },
        required: ["moveFilter", "relativeToFilter", "direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveIntoFrame",
      description:
        "Move objects INTO a frame. USE for 'move X into the Y frame', 'put yellow sticky in Sprint Planning'. REQUIRED: findFilters (array of {type, color}) and frameLabel. E.g. findFilters:[{type:'sticky', color:'yellow'}, {type:'rect', color:'blue'}], frameLabel:'Sprint Planning'.",
      parameters: {
        type: "object",
        properties: {
          findFilters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["sticky", "text", "frame", "rect", "circle"] },
                color: { type: "string" },
              },
            },
            description: "REQUIRED. Objects to move by type and color. E.g. [{type:'sticky', color:'yellow'}, {type:'rect', color:'blue'}]",
          },
          objectIds: { type: "array", items: { type: "string" }, description: "Explicit object IDs (alternative to findFilters)" },
          frameId: { type: "string", description: "Frame ID if known" },
          frameLabel: {
            type: "string",
            description: "REQUIRED. Frame label/name, e.g. 'Sprint Planning'.",
          },
        },
        required: ["frameLabel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveAll",
      description:
        "Move ALL objects to a side or layout. USE for 'move all/everything to the right/left/top/bottom'. NOT for 'move X above Y'—use moveRelative. NOT for 'move X into frame'—use moveIntoFrame.",
      parameters: {
        type: "object",
        properties: {
          template: {
            type: "string",
            enum: ["right", "left", "top", "bottom", "center", "grid"],
            description: "Where to place all objects",
          },
          centerX: { type: "number", description: "Anchor X (viewport center)" },
          centerY: { type: "number", description: "Anchor Y (viewport center)" },
          cols: { type: "number", description: "Columns for grid template" },
        },
        required: ["template"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arrangeInGrid",
      description:
        "Arrange objects in a grid or line. USE for 'arrange X in grid', 'arrange horizontally', 'arrange diagonally', 'arrange four stickies in a vertical line'. layout: vertical=cols:1, horizontal=cols:N, diagonal=diagonal placement. findFilter selects by type/color.",
      parameters: {
        type: "object",
        properties: {
          findFilter: {
            type: "object",
            description: "Select objects by type and/or color. Required when arranging specific objects.",
            properties: {
              type: { type: "string", enum: ["sticky", "text", "frame", "rect", "circle"] },
              color: { type: "string", description: "e.g. yellow, blue, red" },
            },
          },
          layout: {
            type: "string",
            enum: ["grid", "vertical", "horizontal", "diagonal"],
            description: "grid=2D grid (use cols). vertical=1 column. horizontal=1 row. diagonal=items along diagonal.",
          },
          cols: { type: "number", description: "For grid: columns (2 for 2x2). Ignored when layout is vertical/horizontal/diagonal." },
          objectIds: { type: "array", items: { type: "string" } },
          gap: { type: "number" },
          startX: { type: "number" },
          startY: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createStickyNote",
      description: "Create a single sticky. Use x=100,y=100 or pick coordinates. Viewport will focus on the new sticky.",
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
      description: "Create a frame (container). Use createLabeledFrame for frame + label. Viewport will focus on it.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          color: { type: "string" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createText",
      description: "Create a text label. Use for axis labels, frame labels, etc.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["text", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createAxis",
      description: "Create an axis (arrow line) with optional text label. Label position: top-left, top-middle, top-right, bottom-left, bottom-middle, bottom-right.",
      parameters: {
        type: "object",
        properties: {
          startX: { type: "number" },
          startY: { type: "number" },
          endX: { type: "number" },
          endY: { type: "number" },
          label: { type: "string" },
          labelPosition: { type: "string", enum: ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"] },
        },
        required: ["startX", "startY", "endX", "endY"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createLabeledFrame",
      description: "Create a single frame with a text label (e.g. 'a frame called X' or 'add a frame named X'). Use for: Sprint Planning, Backlog, Ideas, etc. Do NOT use for retrospective boards—use createRetroBoard only when user explicitly wants What Went Well / What Didn't / Action Items columns.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          color: { type: "string" },
        },
        required: ["label", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createColumn",
      description: "Create a vertical column of stickies. First item with isLabel: true becomes bold header.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, color: { type: "string" }, isLabel: { type: "boolean" } },
              required: ["text"],
            },
          },
          x: { type: "number" },
          y: { type: "number" },
          spacing: { type: "number" },
        },
        required: ["items", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createRow",
      description: "Create a horizontal row of stickies. First item with isLabel: true becomes bold header.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, color: { type: "string" }, isLabel: { type: "boolean" } },
              required: ["text"],
            },
          },
          x: { type: "number" },
          y: { type: "number" },
          spacing: { type: "number" },
        },
        required: ["items", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createQuadrants",
      description: "Create a 2x2 grid of four frames. Optional labels (topLeft, topRight, bottomLeft, bottomRight). Uses viewport center. Gap between frames is 8px.",
      parameters: {
        type: "object",
        properties: {
          labels: {
            type: "object",
            properties: {
              topLeft: { type: "string" },
              topRight: { type: "string" },
              bottomLeft: { type: "string" },
              bottomRight: { type: "string" },
            },
          },
          centerX: { type: "number" },
          centerY: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTable",
      description: "Create a grid/table. First row and first column are bold headers. cells[row][col].",
      parameters: {
        type: "object",
        properties: {
          cells: { type: "array", items: { type: "array", items: { type: "string" } } },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["cells", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createSWOT",
      description: "Create a SWOT analysis template: 4 quadrants (Strengths, Weaknesses, Opportunities, Threats). Uses viewport center. Call with empty object {} - no parameters needed.",
      parameters: {
        type: "object",
        properties: {
          centerX: { type: "number", description: "Optional; defaults to viewport center" },
          centerY: { type: "number", description: "Optional; defaults to viewport center" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createUserJourneyMap",
      description:
        "Create a user journey map. Columns default to Stage 1, Stage 2, etc. Pass columnCount (1–10). Optionally pass labels array for custom column names (e.g. [Awareness, Consideration, Purchase]). Each frame has 5 empty stickies.",
      parameters: {
        type: "object",
        properties: {
          columnCount: {
            type: "number",
            description: "Number of stages/columns (1–10). Default 5.",
          },
          labels: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional. Custom labels per column. If provided, used for each column; missing entries fall back to Stage N.",
          },
          centerX: { type: "number" },
          centerY: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createRetroBoard",
      description: "ONLY for retrospective meetings: 3 columns (What Went Well, What Didn't, Action Items). Call ONLY when user explicitly asks for a retrospective. Do NOT use for Sprint Planning, Sprint Review, Backlog, or other named frames—use createLabeledFrame with label instead.",
      parameters: {
        type: "object",
        properties: {
          centerX: { type: "number" },
          centerY: { type: "number" },
          itemsPerColumn: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createFlowDiagram",
      description:
        "Create a flow diagram with arrows. LINEAR: use steps array for simple sequences. BRANCHING: use nodes+edges for decision trees, flowcharts. For COMPLEX topics (OS, processes, decision trees): include 12-25+ nodes—be thorough. Max 25 nodes.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: { type: "string" },
            description:
              "Linear flow: ordered step labels. E.g. ['Start', 'Click Settings', 'Reset password', 'Done']. Use when no branching.",
          },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique id (e.g. 'a', 'b', 'step1'). Referenced in edges." },
                text: { type: "string", description: "Node label" },
              },
              required: ["id", "text"],
            },
            description: "Branching flow: nodes with unique ids. Use with edges. E.g. [{id:'start', text:'Start'}, {id:'decision', text:'Valid?'}, {id:'yes', text:'Continue'}, {id:'no', text:'Retry'}]",
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", description: "Source node id" },
                to: { type: "string", description: "Target node id" },
              },
              required: ["from", "to"],
            },
            description: "Branching flow: connections. E.g. [{from:'start', to:'decision'}, {from:'decision', to:'yes'}, {from:'decision', to:'no'}]",
          },
          direction: {
            type: "string",
            enum: ["vertical", "horizontal"],
            description: "Layout direction. Default vertical.",
          },
          color: {
            type: "string",
            description: "Optional sticky color (e.g. yellow, blue).",
          },
          centerX: { type: "number" },
          centerY: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveObject",
      description: "Move a single object. Requires objectId.",
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
      name: "resizeFrameToFitContents",
      description:
        "Resize a frame to fit its contents (children inside it). USE THIS for 'resize frame to fit contents'. objectId optional—omit to resize the first frame.",
      parameters: {
        type: "object",
        properties: {
          objectId: { type: "string", description: "Optional. Frame to resize. Omit for first frame." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resizeObject",
      description: "Resize an object to specific width and height. For 'resize frame to fit contents' use resizeFrameToFitContents instead.",
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
      description:
        "Change object color. Use findFirst when objectId unknown: findFirst.type='sticky' finds first sticky (including inside frames). findFirst.textContains narrows by text.",
      parameters: {
        type: "object",
        properties: {
          objectId: { type: "string", description: "Optional if findFirst provided." },
          color: { type: "string", description: "e.g. red, blue, yellow" },
          findFirst: {
            type: "object",
            description: "Find object by type/text. Use when objectId unknown.",
            properties: {
              type: {
                type: "string",
                enum: ["sticky", "text", "frame", "rect", "circle"],
                description: "Object type. sticky = sticky note (including in frames).",
              },
              textContains: {
                type: "string",
                description: "Optional. Text content to search for.",
              },
            },
          },
        },
        required: ["color"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spaceEvenly",
      description: "Space objects evenly in a row or column. Omit objectIds or pass [] for all objects.",
      parameters: {
        type: "object",
        properties: {
          objectIds: {
            type: "array",
            items: { type: "string" },
            description: "Optional. Omit or [] for all objects.",
          },
          direction: { type: "string", enum: ["horizontal", "vertical", "row", "col"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findObjects",
      description:
        "Find by TEXT content only (e.g. query 'budget' finds stickies containing 'budget'). Does NOT filter by type or color. NEVER use for 'arrange stickies'—use arrangeInGrid(findFilter) instead.",
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
      name: "calculateCenter",
      description: "Compute the center (x, y) of a bounding box for objects. Use objectIds or findFilter. Returns center coordinates for use with zoomTo.",
      parameters: {
        type: "object",
        properties: {
          objectIds: { type: "array", items: { type: "string" }, description: "Object IDs to include" },
          findFilter: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["sticky", "text", "frame", "rect", "circle"] },
              color: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "zoomTo",
      description: "Pan so a world point is centered in the viewport. Clamps zoom to minZoom-maxZoom (default 50-100%). Use with calculateCenter to zoom to a group's center.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "World X of point to center" },
          y: { type: "number", description: "World Y of point to center" },
          minZoom: { type: "number", description: "Min zoom %, default 50" },
          maxZoom: { type: "number", description: "Max zoom %, default 100" },
        },
        required: ["x", "y"],
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
      description: "Zoom the VIEWPORT to show all content (camera zoom). NOT for resizing a frame object—use resizeFrameToFitContents for that.",
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

const DEFAULT_CENTER = { x: 800, y: 500 };

function estimateCreatedEntities(name: string, args: Record<string, unknown>): number {
  switch (name) {
    case "createStickyNote":
    case "createShape":
    case "createFrame":
    case "createText":
    case "createAxis":
    case "createLabeledFrame":
      return 1;
    case "createBulkStickies": {
      const arr = args.stickies as Array<unknown> | undefined;
      return Array.isArray(arr) ? Math.min(MAX_ENTITIES, arr.length) : 0;
    }
    case "createColumn": {
      const items = (args.items as Array<unknown>) ?? [];
      return items.length;
    }
    case "createRow": {
      const items = (args.items as Array<unknown>) ?? [];
      return items.length;
    }
    case "createTable": {
      const cells = (args.cells as Array<Array<unknown>>) ?? [];
      return cells.reduce((sum, row) => sum + (row?.length ?? 0), 0);
    }
    case "createQuadrants":
      return 10; // 2 axes + 4 frames + 4 labels + lines
    case "createSWOT":
      return 10;
    case "createUserJourneyMap": {
      const cols = Math.min(Math.max((args.columnCount as number | undefined) ?? 5, 1), 10);
      return cols * 7; // frames + labels + 5 stickies per column
    }
    case "createRetroBoard":
      return 15; // 3 cols * 4 stickies + headers
    case "createFlowDiagram": {
      const steps = (args.steps as string[]) ?? [];
      const nodes = (args.nodes as Array<{ id: string; text: string }>) ?? [];
      const edges = (args.edges as Array<{ from: string; to: string }>) ?? [];
      const n = steps.length > 0 ? steps.length : Math.min(nodes.length, 25);
      const e = steps.length > 0 ? Math.max(0, n - 1) : edges.length;
      return n > 0 ? n + e : 0;
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
      const arrCenter = viewportCenter ?? undefined;
      return createBulkStickies(ctxWithMeta, {
        stickies,
        layoutPlan,
        centerX: arrCenter?.x,
        centerY: arrCenter?.y,
      });
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
      const shapeW = shapeArgs.width ?? 220;
      const shapeH = shapeArgs.height ?? 140;
      const shapePos = viewportCenter
        ? computeFanOutPlacement(
            viewportCenter.x,
            viewportCenter.y,
            shapeW,
            shapeH,
            ctx.objects
          )
        : { x: shapeArgs.x, y: shapeArgs.y };
      return createShape(ctxWithMeta, {
        ...shapeArgs,
        x: shapePos.x,
        y: shapePos.y,
      });
    }
    case "createFrame": {
      const frameArgs = args as { x: number; y: number; width?: number; height?: number; color?: string };
      const frameW = frameArgs.width ?? 320;
      const frameH = frameArgs.height ?? 200;
      const framePos = viewportCenter
        ? computeFanOutPlacement(
            viewportCenter.x,
            viewportCenter.y,
            frameW,
            frameH,
            ctx.objects
          )
        : { x: frameArgs.x, y: frameArgs.y };
      return createFrame(ctxWithMeta, {
        ...frameArgs,
        x: framePos.x,
        y: framePos.y,
      });
    }
    case "createText":
      return createText(ctxWithMeta, args as { text: string; x: number; y: number });
    case "createAxis":
      return createAxis(ctxWithMeta, args as Parameters<typeof createAxis>[1]);
    case "createLabeledFrame": {
      const lfArgs = args as { label: string; x: number; y: number; width?: number; height?: number; color?: string };
      const lfW = lfArgs.width ?? 320;
      const lfH = lfArgs.height ?? 200;
      const center = viewportCenter ?? DEFAULT_CENTER;
      const lfPos = viewportCenter
        ? computeFanOutPlacement(center.x, center.y, lfW, lfH, ctx.objects)
        : { x: lfArgs.x, y: lfArgs.y };
      await createLabeledFrame(ctxWithMeta, { ...lfArgs, x: lfPos.x, y: lfPos.y });
      return `Created labeled frame "${lfArgs.label}" at (${lfPos.x}, ${lfPos.y}).`;
    }
    case "createColumn": {
      const colArgs = args as { items: import("./tools/createColumn").ColumnItem[]; x: number; y: number; spacing?: number };
      const colCenter = viewportCenter ?? DEFAULT_CENTER;
      const colX = viewportCenter ? Math.round(colCenter.x - 90) : colArgs.x;
      const colY = viewportCenter ? Math.round(colCenter.y - 150) : colArgs.y;
      return createColumn(ctxWithMeta, { ...colArgs, x: colX, y: colY });
    }
    case "createRow": {
      const rowArgs = args as { items: import("./tools/createRow").RowItem[]; x: number; y: number; spacing?: number };
      const rowCenter = viewportCenter ?? DEFAULT_CENTER;
      const rowX = viewportCenter ? Math.round(rowCenter.x - 200) : rowArgs.x;
      const rowY = viewportCenter ? Math.round(rowCenter.y - 60) : rowArgs.y;
      return createRow(ctxWithMeta, { ...rowArgs, x: rowX, y: rowY });
    }
    case "createQuadrants": {
      const qArgs = args as { labels?: import("./tools/createQuadrants").QuadrantLabels; centerX?: number; centerY?: number };
      const qCenter = viewportCenter ?? DEFAULT_CENTER;
      return createQuadrants(ctxWithMeta, {
        labels: qArgs.labels,
        centerX: qArgs.centerX ?? qCenter.x,
        centerY: qArgs.centerY ?? qCenter.y,
      });
    }
    case "createTable": {
      const tableArgs = args as { cells: string[][]; x: number; y: number; cellGap?: number };
      const tableCenter = viewportCenter ?? DEFAULT_CENTER;
      const tableX = viewportCenter ? Math.round(tableCenter.x - 200) : tableArgs.x;
      const tableY = viewportCenter ? Math.round(tableCenter.y - 100) : tableArgs.y;
      return createTable(ctxWithMeta, { ...tableArgs, x: tableX, y: tableY });
    }
    case "createSWOT": {
      const swotCenter = viewportCenter ?? DEFAULT_CENTER;
      const swotArgs = args as { centerX?: number; centerY?: number };
      return createSWOT(ctxWithMeta, {
        centerX: swotArgs.centerX ?? swotCenter.x,
        centerY: swotArgs.centerY ?? swotCenter.y,
      });
    }
    case "createUserJourneyMap": {
      const ujmCenter = viewportCenter ?? DEFAULT_CENTER;
      const ujmArgs = args as {
        columnCount?: number;
        labels?: string[];
        centerX?: number;
        centerY?: number;
      };
      return createUserJourneyMap(ctxWithMeta, {
        columnCount: ujmArgs.columnCount ?? 5,
        labels: Array.isArray(ujmArgs.labels) ? ujmArgs.labels : undefined,
        centerX: ujmArgs.centerX ?? ujmCenter.x,
        centerY: ujmArgs.centerY ?? ujmCenter.y,
      });
    }
    case "createRetroBoard": {
      const retroCenter = viewportCenter ?? DEFAULT_CENTER;
      const retroArgs = args as { centerX?: number; centerY?: number; itemsPerColumn?: number };
      return createRetroBoard(ctxWithMeta, {
        centerX: retroArgs.centerX ?? retroCenter.x,
        centerY: retroArgs.centerY ?? retroCenter.y,
        itemsPerColumn: retroArgs.itemsPerColumn,
      });
    }
    case "createFlowDiagram": {
      const flowCenter = viewportCenter ?? DEFAULT_CENTER;
      const flowArgs = args as {
        steps?: string[];
        nodes?: Array<{ id: string; text: string }>;
        edges?: Array<{ from: string; to: string }>;
        direction?: "vertical" | "horizontal";
        color?: string;
        centerX?: number;
        centerY?: number;
      };
      return createFlowDiagram(ctxWithMeta, {
        steps: flowArgs.steps,
        nodes: flowArgs.nodes,
        edges: flowArgs.edges,
        direction: flowArgs.direction,
        color: flowArgs.color,
        centerX: flowArgs.centerX ?? flowCenter.x,
        centerY: flowArgs.centerY ?? flowCenter.y,
      });
    }
    case "moveRelative": {
      const mrArgs = args as {
        moveFilter?: FindFilter;
        relativeToFilter?: FindFilter;
        direction?: "above" | "below" | "leftOf" | "rightOf";
        gap?: number;
      };
      return moveRelative(ctxWithMeta, {
        moveFilter: (mrArgs.moveFilter ?? {}) as FindFilter,
        relativeToFilter: (mrArgs.relativeToFilter ?? {}) as FindFilter,
        direction: mrArgs.direction ?? "above",
        gap: mrArgs.gap,
      });
    }
    case "moveIntoFrame": {
      const mifArgs = args as {
        findFilters?: FindFilter[];
        objectIds?: string[];
        frameId?: string;
        frameLabel?: string;
      };
      return moveIntoFrame(ctxWithMeta, {
        findFilters: mifArgs.findFilters,
        objectIds: mifArgs.objectIds,
        frameId: mifArgs.frameId,
        frameLabel: mifArgs.frameLabel,
      });
    }
    case "moveAll": {
      const moveAllCenter = viewportCenter ?? DEFAULT_CENTER;
      const moveAllArgs = args as {
        template: "right" | "left" | "top" | "bottom" | "center" | "grid";
        centerX?: number;
        centerY?: number;
        cols?: number;
      };
      return moveAll(ctxWithMeta, {
        template: moveAllArgs.template,
        centerX: moveAllArgs.centerX ?? moveAllCenter.x,
        centerY: moveAllArgs.centerY ?? moveAllCenter.y,
        cols: moveAllArgs.cols,
      });
    }
    case "moveObject":
      return moveObject(ctxWithMeta, {
        objectId: (args as { objectId: string }).objectId,
        x: (args as { x: number }).x,
        y: (args as { y: number }).y,
        parentId: (args as { parentId?: string | null }).parentId ?? undefined,
      });
    case "resizeFrameToFitContents":
      return resizeFrameToFitContents(ctxWithMeta, {
        objectId: (args as { objectId?: string }).objectId,
      });
    case "resizeObject":
      return resizeObject(ctxWithMeta, args as { objectId: string; width: number; height: number });
    case "updateText":
      return updateText(ctxWithMeta, args as { objectId: string; newText: string });
    case "changeColor":
      return changeColor(ctxWithMeta, {
        objectId: (args as { objectId?: string }).objectId,
        color: (args as { color: string }).color,
        findFirst: (args as {
          findFirst?: { type?: "sticky" | "rect" | "circle" | "frame" | "text"; textContains?: string };
        }).findFirst,
      });
    case "arrangeInGrid": {
      const arrArgs = args as {
        objectIds?: string[];
        findFilter?: FindFilter;
        cols?: number;
        rows?: number;
        layout?: string;
        gap?: number;
        startX?: number;
        startY?: number;
      };
      const arrCenter = viewportCenter ?? undefined;
      return arrangeInGrid(ctxWithMeta, {
        objectIds: Array.isArray(arrArgs.objectIds) ? arrArgs.objectIds : [],
        findFilter: arrArgs.findFilter,
        cols: arrArgs.cols,
        rows: arrArgs.rows,
        layout: arrArgs.layout as "grid" | "vertical" | "horizontal" | "diagonal" | undefined,
        gap: arrArgs.gap,
        startX: arrArgs.startX,
        startY: arrArgs.startY,
        centerX: arrArgs.startX == null && arrCenter ? arrCenter.x : undefined,
        centerY: arrArgs.startY == null && arrCenter ? arrCenter.y : undefined,
      });
    }
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
    case "calculateCenter":
      return calculateCenter(ctxWithMeta, {
        objectIds: Array.isArray((args as { objectIds?: string[] }).objectIds)
          ? (args as { objectIds: string[] }).objectIds
          : undefined,
        findFilter: (args as { findFilter?: FindFilter }).findFilter,
      });
    case "zoomTo":
      return zoomTo(ctxWithMeta, {
        x: (args as { x: number }).x,
        y: (args as { y: number }).y,
        minZoom: (args as { minZoom?: number }).minZoom,
        maxZoom: (args as { maxZoom?: number }).maxZoom,
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
