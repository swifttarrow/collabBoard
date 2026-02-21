import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getAbsolutePosition } from "@/lib/board/scene-graph";

const DEFAULT_GAP = 16;
const DEFAULT_START_X = 80;
const DEFAULT_START_Y = 80;

/**
 * Arrange objects in a grid layout.
 * Call getBoardState first to get object IDs.
 */
export async function arrangeInGrid(
  ctx: ToolContext,
  params: {
    objectIds: string[];
    cols?: number;
    rows?: number;
    gap?: number;
    startX?: number;
    startY?: number;
  }
): Promise<string> {
  await getBoardState(ctx);

  const ids = params.objectIds?.filter((id) => ctx.objects[id]) ?? [];
  if (ids.length === 0) {
    return "Error: No valid objects to arrange.";
  }

  const cols = params.cols ?? Math.ceil(Math.sqrt(ids.length));
  const gap = params.gap ?? DEFAULT_GAP;
  const startX = params.startX ?? DEFAULT_START_X;
  const startY = params.startY ?? DEFAULT_START_Y;

  let maxW = 0;
  let maxH = 0;
  for (const id of ids) {
    const obj = ctx.objects[id];
    if (obj && obj.width != null && obj.height != null) {
      maxW = Math.max(maxW, obj.width);
      maxH = Math.max(maxH, obj.height);
    }
  }
  const cellW = maxW + gap;
  const cellH = maxH + gap;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const obj = ctx.objects[id];
    if (!obj) continue;

    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + rowIdx * cellH;

    const result = await moveObject(ctx, { objectId: id, x, y });
    if (result.startsWith("Error:")) return result;
  }

  const broadcastViewport = ctx.broadcastViewportCommand;
  if (broadcastViewport && ids.length > 0) {
    broadcastViewport({ action: "frameToObjects", objectIds: ids });
  }

  return `Arranged ${ids.length} objects in a ${cols}-column grid.`;
}
