import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { resolveColor } from "@/lib/ai/color-map";
import type { BoardObjectWithMeta } from "@/lib/board/store";

type FindFilter = { type?: "sticky" | "text" | "frame" | "rect" | "circle"; color?: string };

function filterObjects(
  objects: Record<string, BoardObjectWithMeta>,
  findFilter: FindFilter
): BoardObjectWithMeta[] {
  let candidates = Object.values(objects).filter((o) => o.type !== "line");
  if (findFilter.type) {
    candidates = candidates.filter((o) => o.type === findFilter.type);
  }
  if (findFilter.color) {
    const hexNorm = resolveColor(findFilter.color).toLowerCase();
    candidates = candidates.filter(
      (o) => (o.color ?? "").trim().toLowerCase() === hexNorm
    );
  }
  return candidates;
}

function hasFilter(findFilter: FindFilter): boolean {
  return !!(findFilter.type || findFilter.color);
}

function computeBounds(
  ids: string[],
  objects: Record<string, BoardObjectWithMeta>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const obj = objects[id];
    if (!obj) continue;
    const abs = obj.parentId
      ? getAbsolutePosition(obj.parentId, objects)
      : { x: 0, y: 0 };
    const ax = obj.x + abs.x;
    const ay = obj.y + abs.y;
    const aw = obj.width ?? 0;
    const ah = obj.height ?? 0;
    minX = Math.min(minX, ax);
    minY = Math.min(minY, ay);
    maxX = Math.max(maxX, ax + aw);
    maxY = Math.max(maxY, ay + ah);
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

const DEFAULT_GAP = 24;

/**
 * Move a group of objects to be positioned relative to another group.
 * E.g. "move blue stickies above yellow ones" → moveFilter:{color:'blue'}, relativeToFilter:{color:'yellow'}, direction:'above'
 */
export async function moveRelative(
  ctx: ToolContext,
  params: {
    moveFilter: FindFilter;
    relativeToFilter: FindFilter;
    direction: "above" | "below" | "leftOf" | "rightOf";
    gap?: number;
  }
): Promise<string> {
  await getBoardState(ctx);

  console.log("[moveRelative] called", {
    moveFilter: params.moveFilter,
    relativeToFilter: params.relativeToFilter,
    direction: params.direction,
  });

  if (!hasFilter(params.moveFilter) || !hasFilter(params.relativeToFilter)) {
    return "Error: moveFilter and relativeToFilter must specify type and/or color.";
  }

  const moveObjs = filterObjects(ctx.objects, params.moveFilter);
  const refObjs = filterObjects(ctx.objects, params.relativeToFilter);

  console.log("[moveRelative] filtered", {
    moveCount: moveObjs.length,
    moveSample: moveObjs.slice(0, 2).map((o) => ({ id: o.id, type: o.type, color: o.color })),
    refCount: refObjs.length,
    refSample: refObjs.slice(0, 2).map((o) => ({ id: o.id, type: o.type, color: o.color })),
  });

  if (moveObjs.length === 0) {
    return `Error: No objects to move matching ${params.moveFilter.color ?? params.moveFilter.type ?? "filter"}.`;
  }
  if (refObjs.length === 0) {
    return `Error: No reference objects matching ${params.relativeToFilter.color ?? params.relativeToFilter.type ?? "filter"}.`;
  }

  const moveIds = moveObjs.map((o) => o.id);
  const refIds = refObjs.map((o) => o.id);
  const moveBounds = computeBounds(moveIds, ctx.objects);
  const refBounds = computeBounds(refIds, ctx.objects);

  if (!moveBounds || !refBounds) {
    return "Error: Could not compute bounds.";
  }

  const gap = params.gap ?? DEFAULT_GAP;

  let deltaX = 0;
  let deltaY = 0;

  const moveCenterX = (moveBounds.minX + moveBounds.maxX) / 2;
  const moveCenterY = (moveBounds.minY + moveBounds.maxY) / 2;
  const refCenterX = (refBounds.minX + refBounds.maxX) / 2;
  const refCenterY = (refBounds.minY + refBounds.maxY) / 2;

  switch (params.direction) {
    case "above":
      // Move group so its bottom edge is just above ref's top edge. Align centers horizontally.
      deltaY = refBounds.minY - gap - moveBounds.maxY;
      deltaX = refCenterX - moveCenterX;
      break;
    case "below":
      deltaY = refBounds.maxY + gap - moveBounds.minY;
      deltaX = refCenterX - moveCenterX;
      break;
    case "leftOf":
      deltaX = refBounds.minX - gap - moveBounds.maxX;
      deltaY = refCenterY - moveCenterY;
      break;
    case "rightOf":
      deltaX = refBounds.maxX + gap - moveBounds.minX;
      deltaY = refCenterY - moveCenterY;
      break;
  }

  for (const obj of moveObjs) {
    const abs = obj.parentId
      ? getAbsolutePosition(obj.parentId, ctx.objects)
      : { x: 0, y: 0 };
    const newAbsX = obj.x + abs.x + deltaX;
    const newAbsY = obj.y + abs.y + deltaY;
    let x = newAbsX;
    let y = newAbsY;
    if (obj.parentId) {
      const parentAbs = getAbsolutePosition(obj.parentId, ctx.objects);
      x = newAbsX - parentAbs.x;
      y = newAbsY - parentAbs.y;
    }
    const result = await moveObject(ctx, {
      objectId: obj.id,
      x,
      y,
      parentId: obj.parentId ?? undefined,
    });
    if (result.startsWith("Error:")) return result;
  }

  if (ctx.broadcastViewportCommand && moveIds.length > 0) {
    ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: moveIds });
  }

  return `Moved ${moveObjs.length} object(s) ${params.direction} the ${params.relativeToFilter.color ?? params.relativeToFilter.type ?? "reference"} ones.`;
}
