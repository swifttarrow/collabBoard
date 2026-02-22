import { DEFAULT_STICKY, FRAME_HEADER_HEIGHT } from "@/components/canvas/constants";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { measureStickyText } from "@/lib/sticky-measure";
import type { ToolContext } from "./types";
import { createFrame } from "./createFrame";
import { createText } from "./createText";
import { moveObject } from "./moveObject";

const GRID_GAP = 20;
const LABEL_TO_GRID_GAP = 12;
const CLUSTER_COLS = 3;
const FRAME_PADDING = 16;
const CLUSTER_GAP = 48;
const DEFAULT_START = 80;

/**
 * Find placement for clusters below existing content.
 */
function suggestPlacement(objects: Record<string, BoardObjectWithMeta>): {
  startX: number;
  startY: number;
} {
  const entries = Object.values(objects);
  if (entries.length === 0) return { startX: DEFAULT_START, startY: DEFAULT_START };

  let maxBottom = 0;
  let minLeft = Infinity;
  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") continue;
    if (obj.width != null && obj.height != null) {
      maxBottom = Math.max(maxBottom, abs.y + obj.height);
      minLeft = Math.min(minLeft, abs.x);
    }
  }
  return {
    startX: minLeft !== Infinity ? minLeft : DEFAULT_START,
    startY: maxBottom + 60,
  };
}

/**
 * Cluster stickies into categories. Each cluster gets a frame with a bold title
 * and stickies arranged with uniform spacing. Stickies are visible and readable.
 */
export async function clusterStickies(
  ctx: ToolContext,
  params: {
    categories: Array<{ name: string; stickyIds: string[] }>;
    startX?: number;
    startY?: number;
  },
): Promise<string> {
  const { objects } = ctx;
  const { startX: paramStartX, startY: paramStartY } = params;
  const { startX: suggestedX, startY: suggestedY } = suggestPlacement(ctx.objects);
  const startX = paramStartX ?? suggestedX;
  let currentY = paramStartY ?? suggestedY;

  const results: string[] = [];

  for (const category of params.categories) {
    const stickyIds = category.stickyIds.filter(
      (id) => objects[id]?.type === "sticky",
    );
    if (stickyIds.length === 0) {
      results.push(`Skipped "${category.name}" (no valid stickies)`);
      continue;
    }

    const dimensions = stickyIds.map((id) => {
      const obj = objects[id];
      if (!obj || obj.type !== "sticky") return DEFAULT_STICKY;
      const text = (obj as { text?: string }).text ?? "";
      return measureStickyText(text);
    });

    const cols = CLUSTER_COLS;
    const rows = Math.ceil(stickyIds.length / cols);

    const colWidths: number[] = [];
    const rowHeights: number[] = [];
    for (let c = 0; c < cols; c++) colWidths[c] = 0;
    for (let i = 0; i < stickyIds.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      colWidths[col] = Math.max(colWidths[col] ?? 0, dimensions[i]!.width);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, dimensions[i]!.height);
    }

    const totalWidth =
      colWidths.reduce((a, w) => a + w, 0) + (cols - 1) * GRID_GAP;
    const totalHeight =
      rowHeights.reduce((a, h) => a + h, 0) + (rows - 1) * GRID_GAP;

    const frameContentHeight = totalHeight + LABEL_TO_GRID_GAP;
    const frameHeight = FRAME_HEADER_HEIGHT + FRAME_PADDING * 2 + frameContentHeight;
    const frameWidth = Math.max(totalWidth + FRAME_PADDING * 2, 200);

    const frameResult = await createFrame(ctx, {
      x: startX,
      y: currentY,
      width: frameWidth,
      height: frameHeight,
    });
    if (frameResult.startsWith("Error:")) {
      results.push(frameResult);
      continue;
    }

    const frameId = frameResult.match(/Id: ([a-f0-9-]+)/)?.[1];
    if (!frameId) {
      results.push(`Failed to get frame id for "${category.name}"`);
      continue;
    }

    const labelAbsX = startX + FRAME_PADDING;
    const labelAbsY = currentY + FRAME_HEADER_HEIGHT;
    const labelResult = await createText(ctx, {
      text: `<p><strong>${category.name}</strong></p>`,
      x: labelAbsX,
      y: labelAbsY,
    });
    const labelId = labelResult.match(/Id: ([a-f0-9-]+)/)?.[1];
    if (labelId) {
      await moveObject(ctx, {
        objectId: labelId,
        x: labelAbsX,
        y: labelAbsY,
        parentId: frameId,
      });
    }

    const contentStartX = startX + FRAME_PADDING;
    const contentStartY =
      currentY + FRAME_HEADER_HEIGHT + LABEL_TO_GRID_GAP + FRAME_PADDING;

    const colOffsets: number[] = [0];
    for (let c = 0; c < cols - 1; c++) {
      colOffsets[c + 1] = (colOffsets[c] ?? 0) + (colWidths[c] ?? 0) + GRID_GAP;
    }
    const rowOffsets: number[] = [0];
    for (let r = 0; r < rows - 1; r++) {
      rowOffsets[r + 1] =
        (rowOffsets[r] ?? 0) + (rowHeights[r] ?? 0) + GRID_GAP;
    }

    for (let i = 0; i < stickyIds.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const absX = contentStartX + (colOffsets[col] ?? 0);
      const absY = contentStartY + (rowOffsets[row] ?? 0);
      const moveResult = await moveObject(ctx, {
        objectId: stickyIds[i]!,
        x: absX,
        y: absY,
        parentId: frameId,
      });
      results.push(moveResult);
    }

    currentY += frameHeight + CLUSTER_GAP;
  }

  return `Clustered into ${params.categories.length} categories:\n${results.join("\n")}`;
}
