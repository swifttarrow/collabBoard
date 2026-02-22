import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
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
    const abs = getAbsolutePosition(id, objects);
    const aw = obj.width ?? 0;
    const ah = obj.height ?? 0;
    minX = Math.min(minX, abs.x);
    minY = Math.min(minY, abs.y);
    maxX = Math.max(maxX, abs.x + aw);
    maxY = Math.max(maxY, abs.y + ah);
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Calculate the center of a bounding box for a set of objects.
 * Returns centerX and centerY in world coordinates.
 */
export async function calculateCenter(
  ctx: ToolContext,
  params: {
    objectIds?: string[];
    findFilter?: FindFilter;
  }
): Promise<string> {
  await getBoardState(ctx);

  let ids: string[];
  if (params.objectIds?.length && params.objectIds.filter((id) => ctx.objects[id]).length) {
    ids = params.objectIds.filter((id) => ctx.objects[id]);
  } else if (params.findFilter && (params.findFilter.type || params.findFilter.color)) {
    ids = filterObjects(ctx.objects, params.findFilter).map((o) => o.id);
  } else {
    return "Error: Provide objectIds or findFilter (type and/or color).";
  }

  if (ids.length === 0) {
    return "Error: No objects found.";
  }

  const bounds = computeBounds(ids, ctx.objects);
  if (!bounds) {
    return "Error: Could not compute bounds.";
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return `Center: x=${Math.round(centerX)}, y=${Math.round(centerY)}`;
}
