import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getRootObjects } from "@/lib/board/scene-graph";
import {
  MOVE_ALL_GAP,
  type MoveAllTemplate,
} from "@/lib/ai/templates/constants";

/**
 * Move all root-level objects using a layout template.
 * Templates: right, left, top, bottom, center, grid.
 * Uses centerX, centerY as anchor (default viewport center).
 */
export async function moveAll(
  ctx: ToolContext,
  params: {
    template: MoveAllTemplate;
    centerX?: number;
    centerY?: number;
    cols?: number; // for grid template
  }
): Promise<string> {
  console.log("[moveAll] called", {
    boardId: ctx.boardId,
    template: params.template,
    centerX: params.centerX,
    centerY: params.centerY,
    objectCountBeforeGetBoardState: Object.keys(ctx.objects).length,
  });

  await getBoardState(ctx);

  const roots = getRootObjects(ctx.objects);
  const ids = roots.map((o) => o.id);

  console.log("[moveAll] after getBoardState", {
    totalObjectsInCtx: Object.keys(ctx.objects).length,
    rootCount: roots.length,
    rootIds: ids,
    rootTypes: roots.map((r) => r.type),
    sampleRoot: roots[0]
      ? {
          id: roots[0].id,
          type: roots[0].type,
          parentId: roots[0].parentId,
          x: roots[0].x,
          y: roots[0].y,
          width: roots[0].width,
          height: roots[0].height,
        }
      : null,
  });

  if (ids.length === 0) {
    console.log("[moveAll] no root objects, returning error");
    return "Error: No objects on the board to move.";
  }

  const cx = params.centerX ?? 800;
  const cy = params.centerY ?? 500;
  const gap = MOVE_ALL_GAP;
  const template = params.template ?? "right";

  // Collect dimensions
  let maxW = 0;
  let maxH = 0;
  for (const id of ids) {
    const obj = ctx.objects[id];
    if (obj?.width != null && obj?.height != null) {
      maxW = Math.max(maxW, obj.width);
      maxH = Math.max(maxH, obj.height);
    }
  }
  const cellW = maxW + gap;
  const cellH = maxH + gap;

  const n = ids.length;
  const cols = params.cols ?? Math.ceil(Math.sqrt(n));

  if (template === "grid") {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const obj = ctx.objects[id];
      if (!obj) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const startX = cx - (cols * cellW) / 2 + cellW / 2;
      const startY = cy - (Math.ceil(n / cols) * cellH) / 2 + cellH / 2;
      const x = Math.round(startX + col * cellW);
      const y = Math.round(startY + row * cellH);
      const result = await moveObject(ctx, { objectId: id, x, y });
      if (result.startsWith("Error:")) return result;
    }
    if (ctx.broadcastViewportCommand && ids.length > 0) {
      ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
    }
    return `Moved ${ids.length} objects into a ${cols}-column grid.`;
  }

  if (template === "right") {
    const anchorX = cx + 180; // right side of viewport
    const totalH = n * cellH - gap;
    let y = Math.round(cy - totalH / 2 + cellH / 2);
    console.log("[moveAll] template=right", { anchorX, cy, cellH, n });
    for (const id of ids) {
      const obj = ctx.objects[id];
      if (!obj?.width) {
        console.log("[moveAll] skipping object (no width)", { id, type: obj?.type });
        continue;
      }
      const x = Math.round(anchorX - obj.width / 2);
      const result = await moveObject(ctx, { objectId: id, x, y });
      console.log("[moveAll] moveObject result", { id, x, y, result: result.slice(0, 80) });
      if (result.startsWith("Error:")) return result;
      y += cellH;
    }
    if (ctx.broadcastViewportCommand && ids.length > 0) {
      ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
    }
    return `Moved ${ids.length} objects to the right side.`;
  }

  if (template === "left") {
    const anchorX = cx - 300; // left side
    const totalH = n * cellH - gap;
    let y = Math.round(cy - totalH / 2 + cellH / 2);
    for (const id of ids) {
      const obj = ctx.objects[id];
      if (!obj?.width) continue;
      const x = Math.round(anchorX - obj.width / 2);
      const result = await moveObject(ctx, { objectId: id, x, y });
      if (result.startsWith("Error:")) return result;
      y += cellH;
    }
    if (ctx.broadcastViewportCommand && ids.length > 0) {
      ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
    }
    return `Moved ${ids.length} objects to the left side.`;
  }

  if (template === "top") {
    const anchorY = cy - 250; // top
    const totalW = n * cellW - gap;
    let x = Math.round(cx - totalW / 2 + cellW / 2);
    for (const id of ids) {
      const obj = ctx.objects[id];
      if (!obj?.height) continue;
      const y = Math.round(anchorY);
      const result = await moveObject(ctx, { objectId: id, x, y });
      if (result.startsWith("Error:")) return result;
      x += cellW;
    }
    if (ctx.broadcastViewportCommand && ids.length > 0) {
      ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
    }
    return `Moved ${ids.length} objects to the top.`;
  }

  if (template === "bottom") {
    const anchorY = cy + 250; // bottom edge of row
    const totalW = n * cellW - gap;
    let x = Math.round(cx - totalW / 2 + cellW / 2);
    for (const id of ids) {
      const obj = ctx.objects[id];
      if (!obj?.height) continue;
      const y = Math.round(anchorY - obj.height); // align bottoms
      const result = await moveObject(ctx, { objectId: id, x, y });
      if (result.startsWith("Error:")) return result;
      x += cellW;
    }
    if (ctx.broadcastViewportCommand && ids.length > 0) {
      ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
    }
    return `Moved ${ids.length} objects to the bottom.`;
  }

  // center: compact cluster
  const gridCols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const obj = ctx.objects[id];
    if (!obj) continue;
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const totalCols = gridCols;
    const totalRows = Math.ceil(n / gridCols);
    const startX = cx - (totalCols * cellW) / 2 + cellW / 2;
    const startY = cy - (totalRows * cellH) / 2 + cellH / 2;
    const x = Math.round(startX + col * cellW);
    const y = Math.round(startY + row * cellH);
    const result = await moveObject(ctx, { objectId: id, x, y });
    if (result.startsWith("Error:")) return result;
  }
  if (ctx.broadcastViewportCommand && ids.length > 0) {
    ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
  }
  return `Moved ${ids.length} objects to the center.`;
}
