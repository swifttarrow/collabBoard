import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getAbsolutePosition, getRootObjects } from "@/lib/board/scene-graph";

/**
 * Space objects evenly in a row or column.
 * When objectIds is empty or omitted, spaces all root-level objects.
 */
export async function spaceEvenly(
  ctx: ToolContext,
  params: {
    objectIds?: string[];
    direction?: "horizontal" | "vertical" | "row" | "col";
  }
): Promise<string> {
  await getBoardState(ctx);

  const ids =
    params.objectIds?.length && params.objectIds.filter((id) => ctx.objects[id]).length
      ? params.objectIds.filter((id) => ctx.objects[id])
      : getRootObjects(ctx.objects).map((o) => o.id);
  if (ids.length === 0) {
    return "Error: No valid objects to space.";
  }

  const dir = params.direction ?? "horizontal";
  const horizontal = dir === "horizontal" || dir === "row";

  const boxes = ids.map((id) => {
    const obj = ctx.objects[id];
    if (!obj) return null;
    const abs = getAbsolutePosition(id, ctx.objects);
    const w = obj.width ?? 100;
    const h = obj.height ?? 80;
    return { id, x: abs.x, y: abs.y, w, h };
  }).filter(Boolean) as Array<{ id: string; x: number; y: number; w: number; h: number }>;

  if (boxes.length === 0) return "Error: No valid objects.";

  const GAP = 24;
  const startX = horizontal ? Math.min(...boxes.map((b) => b.x)) : boxes[0]!.x;
  const startY = horizontal ? boxes[0]!.y : Math.min(...boxes.map((b) => b.y));

  let pos = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    const x = horizontal ? startX + pos : b.x;
    const y = horizontal ? b.y : startY + pos;

    const result = await moveObject(ctx, { objectId: b.id, x, y });
    if (result.startsWith("Error:")) return result;
    pos += (horizontal ? b.w : b.h) + GAP;
  }

  const movedIds = boxes.map((b) => b.id);
  if (ctx.broadcastViewportCommand && movedIds.length > 0) {
    ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: movedIds });
  }

  return `Spaced ${boxes.length} objects ${horizontal ? "horizontally" : "vertically"}.`;
}
