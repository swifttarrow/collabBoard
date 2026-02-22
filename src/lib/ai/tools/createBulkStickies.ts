/**
 * Create multiple stickies in one call using a layout plan from the LLM.
 * Two-pass approach: LLM outputs plan (no pixel-perfect placement); server creates in grid.
 * Max 100 stickies per call.
 */

import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import { measureStickyText } from "@/lib/sticky-measure";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

const MAX_BULK = 100;
const DEFAULT_GAP = 16;
const DEFAULT_MARGIN = 40;

export type LayoutPlan = {
  count?: number;
  rows?: number;
  cols?: number;
  spacing?: number;
  marginX?: number;
  marginY?: number;
  startX?: number;
  startY?: number;
};

export type StickyItem = {
  text: string;
  color?: string;
};

export async function createBulkStickies(
  ctx: ToolContext,
  params: {
    stickies: StickyItem[];
    layoutPlan?: LayoutPlan;
    /** When provided, grid is centered at this point (viewport center). Overrides layoutPlan.startX/startY. */
    centerX?: number;
    centerY?: number;
  }
): Promise<string> {
  const { boardId, supabase, broadcast, broadcastViewportCommand } = ctx;
  const items = params.stickies?.slice(0, MAX_BULK) ?? [];
  if (items.length === 0) {
    return "Error: No stickies to create.";
  }
  if (items.length > MAX_BULK) {
    return `Error: Cannot create more than ${MAX_BULK} items at once.`;
  }

  const plan: LayoutPlan = params.layoutPlan ?? {};
  const count = items.length;
  const cols = plan.cols ?? Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const spacing = plan.spacing ?? DEFAULT_GAP;
  const marginX = plan.marginX ?? DEFAULT_MARGIN;
  const marginY = plan.marginY ?? DEFAULT_MARGIN;

  const sizes = items.map((item) => measureStickyText(item.text || ""));
  const cellW =
    Math.max(...sizes.map((s) => Math.max(DEFAULT_STICKY.width, s.width)), DEFAULT_STICKY.width) + spacing;
  const cellH =
    Math.max(...sizes.map((s) => Math.max(DEFAULT_STICKY.height, s.height)), DEFAULT_STICKY.height) + spacing;

  const maxW = Math.max(...sizes.map((s) => Math.max(DEFAULT_STICKY.width, s.width)), DEFAULT_STICKY.width);
  const maxH = Math.max(...sizes.map((s) => Math.max(DEFAULT_STICKY.height, s.height)), DEFAULT_STICKY.height);

  let startX: number;
  let startY: number;
  const cx = params.centerX;
  const cy = params.centerY;
  if (cx != null && cy != null && plan.startX == null && plan.startY == null) {
    const totalGridW = (cols - 1) * cellW + maxW;
    const totalGridH = (rows - 1) * cellH + maxH;
    startX = Math.round(cx - totalGridW / 2);
    startY = Math.round(cy - totalGridH / 2);
    console.log("[createBulkStickies] using viewport center", {
      centerX: cx,
      centerY: cy,
      startX,
      startY,
      cols,
      rows,
      totalGridW,
      totalGridH,
    });
  } else {
    startX = plan.startX ?? marginX;
    startY = plan.startY ?? marginY;
    console.log("[createBulkStickies] using layoutPlan defaults", {
      startX,
      startY,
      hasCenter: cx != null,
      hasLayoutPlanStart: plan.startX != null,
    });
  }

  const createdIds: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const id = crypto.randomUUID();
    const color = item.color ? resolveColor(item.color) : "#FDE68A";
    const { width, height } = sizes[i]!;
    const w = Math.max(DEFAULT_STICKY.width, width);
    const h = Math.max(DEFAULT_STICKY.height, height);

    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + rowIdx * cellH;

    const object: BoardObject = {
      id,
      type: "sticky",
      parentId: null,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      color,
      text: item.text ?? "",
    };

    const dbRow = objectToRow(object, boardId);
    const { data: inserted, error } = await supabase
      .from("board_objects")
      .insert(dbRow)
      .select(
        "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by"
      )
      .single();

    if (error) {
      return `Error creating sticky: ${error.message}`;
    }

    const withMeta = toObjectWithMeta(
      inserted as BoardObjectRow & { updated_at: string },
      boardId
    );
    ctx.objects[withMeta.id] = withMeta;
    broadcast({ op: "INSERT", object: withMeta });
    createdIds.push(withMeta.id);
  }

  if (broadcastViewportCommand && createdIds.length > 0) {
    broadcastViewportCommand({ action: "frameToObjects", objectIds: createdIds });
  }

  return `Created ${createdIds.length} stickies. Ids: ${createdIds.join(", ")}`;
}
