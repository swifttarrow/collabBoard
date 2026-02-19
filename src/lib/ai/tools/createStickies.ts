import type { ToolContext } from "./types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { createStickyNote } from "./createStickyNote";
import { measureStickyText } from "@/lib/sticky-measure";

const GRID_GAP = 24;
const STICKY_COLS = 3;
const DEFAULT_START = 80;
const PLACEMENT_MARGIN = 80;

/**
 * Find an empty spot below existing content. Returns { startX, startY } for the next batch.
 * Keeps new stickies close to existing content but not overlapping.
 */
function suggestPlacement(objects: Record<string, BoardObjectWithMeta>): { startX: number; startY: number } {
  const entries = Object.values(objects);
  if (entries.length === 0) return { startX: DEFAULT_START, startY: DEFAULT_START };

  let maxBottom = 0;
  let minLeft = Infinity;
  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") continue; // lines are thin, skip for placement
    if (obj.width != null && obj.height != null) {
      maxBottom = Math.max(maxBottom, abs.y + obj.height);
      minLeft = Math.min(minLeft, abs.x);
    }
  }
  const startY = maxBottom + PLACEMENT_MARGIN;
  const startX = minLeft !== Infinity ? minLeft : DEFAULT_START;
  return { startX, startY };
}

export async function createStickies(
  ctx: ToolContext,
  params: {
    stickies: Array<{ text: string; color?: string }>;
    startX?: number;
    startY?: number;
  }
): Promise<string> {
  const objectsCount = Object.keys(ctx.objects).length;
  const stickyCount = Object.values(ctx.objects).filter((o) => (o as { type?: string }).type === "sticky").length;
  console.log("[createStickies] called", {
    rawStickiesLength: Array.isArray(params.stickies) ? params.stickies.length : 0,
    startX: params.startX,
    startY: params.startY,
    ctxObjectCount: objectsCount,
    ctxStickyCount: stickyCount,
    rawStickiesSample: Array.isArray(params.stickies)
      ? JSON.stringify(params.stickies.slice(0, 2))
      : String(params.stickies),
  });

  const stickies = Array.isArray(params.stickies)
    ? params.stickies.filter((s) => s != null && typeof (s as { text?: unknown }).text === "string")
    : [];
  if (stickies.length === 0) {
    console.log("[createStickies] early return: no valid stickies after filter");
    return "No stickies to create.";
  }

  console.log("[createStickies] proceeding", { validCount: stickies.length });

  // Always place in an empty area below existing content so batches never overlap
  const { startX, startY } = suggestPlacement(ctx.objects);

  try {
  const dimensions = stickies.map((s) => measureStickyText(s.text));
  const colWidths: number[] = [];
  const rowHeights: number[] = [];
  for (let c = 0; c < STICKY_COLS; c++) colWidths[c] = 0;
  for (let i = 0; i < stickies.length; i++) {
    const col = i % STICKY_COLS;
    const row = Math.floor(i / STICKY_COLS);
    colWidths[col] = Math.max(colWidths[col] ?? 0, dimensions[i]!.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, dimensions[i]!.height);
  }

  const colOffsets: number[] = [0];
  for (let c = 0; c < STICKY_COLS - 1; c++) {
    colOffsets[c + 1] = (colOffsets[c] ?? 0) + (colWidths[c] ?? 0) + GRID_GAP;
  }
  const rowOffsets: number[] = [0];
  for (let r = 0; r < rowHeights.length - 1; r++) {
    rowOffsets[r + 1] = (rowOffsets[r] ?? 0) + (rowHeights[r] ?? 0) + GRID_GAP;
  }

  for (let i = 0; i < stickies.length; i++) {
    const col = i % STICKY_COLS;
    const row = Math.floor(i / STICKY_COLS);
    const x = startX + (colOffsets[col] ?? 0);
    const y = startY + (rowOffsets[row] ?? 0);
    await createStickyNote(ctx, {
      text: stickies[i]!.text,
      x,
      y,
      color: stickies[i]?.color,
    });
  }

  const lastRow = rowHeights.length - 1;
  const bottomY = startY + (rowOffsets[lastRow] ?? 0) + (rowHeights[lastRow] ?? 0) + GRID_GAP;
  console.log("[createStickies] success", { created: stickies.length });
  return `Created ${stickies.length} stickies at (${startX}, ${startY}). For next batch below, use startY: ${bottomY}`;
  } catch (err) {
    console.error("[createStickies] error:", err);
    throw err;
  }
}
