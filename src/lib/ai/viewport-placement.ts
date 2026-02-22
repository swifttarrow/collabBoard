import type { BoardObjectWithMeta } from "@/lib/board/store";

/** Gap between entities when fanning out. */
const FAN_SPACING = 100;

/**
 * Check if rect (x, y, w, h) overlaps any top-level object.
 * Uses world-space rects; ignores children (they're inside parent bounds).
 */
function overlapsAny(
  x: number,
  y: number,
  w: number,
  h: number,
  objects: Record<string, BoardObjectWithMeta>,
  gap: number
): boolean {
  const pad = gap / 2;
  for (const obj of Object.values(objects)) {
    if (obj.parentId != null) continue; // only check top-level
    const ow = obj.width ?? 0;
    const oh = obj.height ?? 0;
    // rects overlap if they intersect (with padding)
    if (
      x + w + pad > obj.x - pad &&
      obj.x + ow + pad > x - pad &&
      y + h + pad > obj.y - pad &&
      obj.y + oh + pad > y - pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fan-out positions: center first, then ring around it.
 * Order: (0,0), (1,0), (1,1), (0,1), (-1,1), (-1,0), (-1,-1), (0,-1), (1,-1), (2,0), ...
 */
function* fanOffsets(): Generator<[number, number]> {
  yield [0, 0];
  let ring = 1;
  while (true) {
    // Ring N: cells where max(|dx|,|dy|) === N
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        yield [dx, dy];
      }
    }
    ring++;
  }
}

/**
 * Compute placement for a new entity at viewport center, fanning out if the
 * center would overlap existing objects.
 *
 * @param centerX - Viewport center X (world coords)
 * @param centerY - Viewport center Y (world coords)
 * @param width - Entity width
 * @param height - Entity height
 * @param objects - Current board objects (for overlap check)
 * @returns { x, y } - Top-left corner for the new entity
 */
export function computeFanOutPlacement(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  objects: Record<string, BoardObjectWithMeta>
): { x: number; y: number } {
  const halfW = width / 2;
  const halfH = height / 2;

  for (const [dx, dy] of fanOffsets()) {
    const x = Math.round(centerX - halfW + dx * FAN_SPACING);
    const y = Math.round(centerY - halfH + dy * FAN_SPACING);
    if (!overlapsAny(x, y, width, height, objects, FAN_SPACING)) {
      return { x, y };
    }
  }

  // Fallback: use center (shouldn't happen in practice)
  return {
    x: Math.round(centerX - halfW),
    y: Math.round(centerY - halfH),
  };
}
