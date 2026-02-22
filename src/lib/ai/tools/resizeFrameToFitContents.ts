import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { resizeObject } from "./resizeObject";
import { moveObject } from "./moveObject";
import { getChildren, getRootObjects } from "@/lib/board/scene-graph";
import { MIN_FRAME_WIDTH, MIN_FRAME_HEIGHT } from "@/components/canvas/constants";

const PADDING = 16;

/**
 * Resize a frame to fit its contents (children). When objectId is omitted,
 * resizes the first root-level frame. Shifts children if needed so nothing
 * spills (including items with negative positions).
 */
export async function resizeFrameToFitContents(
  ctx: ToolContext,
  params: { objectId?: string }
): Promise<string> {
  await getBoardState(ctx);

  const roots = getRootObjects(ctx.objects);
  const frames = roots.filter((o) => o.type === "frame");

  const frameId =
    params.objectId && ctx.objects[params.objectId]?.type === "frame"
      ? params.objectId
      : frames[0]?.id;

  if (!frameId) {
    return "Error: No frame found to resize.";
  }

  const frame = ctx.objects[frameId];
  if (!frame || frame.type !== "frame") {
    return "Error: Object is not a frame.";
  }

  const children = getChildren(frameId, ctx.objects);
  if (children.length === 0) {
    return `Frame has no contents. Current size: ${frame.width ?? 0}x${frame.height ?? 0}.`;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  for (const child of children) {
    const x = child.x ?? 0;
    const y = child.y ?? 0;
    const w = child.width ?? 0;
    const h = child.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxRight = Math.max(maxRight, x + w);
    maxBottom = Math.max(maxBottom, y + h);
  }

  const contentW = maxRight - minX;
  const contentH = maxBottom - minY;
  const width = Math.max(MIN_FRAME_WIDTH, Math.ceil(contentW) + 2 * PADDING);
  const height = Math.max(MIN_FRAME_HEIGHT, Math.ceil(contentH) + 2 * PADDING);

  const shiftX = PADDING - minX;
  const shiftY = PADDING - minY;

  for (const child of children) {
    const newX = (child.x ?? 0) + shiftX;
    const newY = (child.y ?? 0) + shiftY;
    const result = await moveObject(ctx, {
      objectId: child.id,
      x: newX,
      y: newY,
      parentId: frameId,
    });
    if (result.startsWith("Error:")) return result;
  }

  return resizeObject(ctx, { objectId: frameId, width, height });
}
