import type { BoardObjectWithMeta } from "./store";

/**
 * Compute absolute position (board coordinates) from local position by summing
 * all ancestor local positions. Single-parent rule: hierarchy is strict tree.
 */
export function getAbsolutePosition(
  nodeId: string,
  objects: Record<string, BoardObjectWithMeta>
): { x: number; y: number } {
  const node = objects[nodeId];
  if (!node) return { x: 0, y: 0 };
  let x = node.x;
  let y = node.y;
  let parentId = node.parentId ?? null;
  while (parentId) {
    const parent = objects[parentId];
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    parentId = parent.parentId ?? null;
  }
  return { x, y };
}

/** Get child node ids for a parent (frames and board root). */
export function getChildren(
  parentId: string | null,
  objects: Record<string, BoardObjectWithMeta>
): BoardObjectWithMeta[] {
  return Object.values(objects).filter(
    (o) => (o.parentId ?? null) === parentId
  );
}

/** Get root-level objects (parentId null). */
export function getRootObjects(
  objects: Record<string, BoardObjectWithMeta>
): BoardObjectWithMeta[] {
  return getChildren(null, objects);
}

/**
 * Returns sticky and text objects in the same render order as BoardSceneGraph.
 * Use this when rendering text overlays so stacking (z-order) matches the shapes.
 */
export function getStickyTextInRenderOrder(
  objects: Record<string, BoardObjectWithMeta>,
  selection: string[]
): BoardObjectWithMeta[] {
  const roots = getRootObjects(objects);
  const unselectedRoots = roots.filter((o) => !selection.includes(o.id));
  const selectedRoots = roots.filter((o) => selection.includes(o.id));
  const sortFramesFirst = (
    a: (typeof roots)[0],
    b: (typeof roots)[0]
  ) => (a.type === "frame" ? 0 : 1) - (b.type === "frame" ? 0 : 1);
  const renderOrder = [
    ...unselectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type === "frame").sort(sortFramesFirst),
    ...unselectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
    ...selectedRoots.filter((o) => o.type !== "frame").sort(sortFramesFirst),
  ];

  const result: BoardObjectWithMeta[] = [];
  function collect(obj: BoardObjectWithMeta) {
    if ((obj.type === "sticky" || obj.type === "text") && obj.id) {
      result.push(obj);
    }
    if (obj.type === "frame") {
      for (const child of getChildren(obj.id, objects)) {
        collect(child);
      }
    }
  }
  for (const root of renderOrder) {
    collect(root);
  }
  return result;
}

/**
 * Reparent node preserving absolute position (uses store position).
 * newParentId: null = board root.
 */
export function computeReparentLocalPosition(
  node: BoardObjectWithMeta,
  newParentId: string | null,
  objects: Record<string, BoardObjectWithMeta>
): { x: number; y: number } {
  const abs = getAbsolutePosition(node.id, objects);
  if (newParentId === null) {
    return abs;
  }
  const parentAbs = getAbsolutePosition(newParentId, objects);
  return {
    x: abs.x - parentAbs.x,
    y: abs.y - parentAbs.y,
  };
}

/**
 * Compute local position in newParent from drop position (x, y) in current parent's space.
 * Use this on drag end - the store position is stale during drag.
 */
export function computeReparentLocalPositionFromDrop(
  dropX: number,
  dropY: number,
  currentParentId: string | null,
  newParentId: string | null,
  objects: Record<string, BoardObjectWithMeta>
): { x: number; y: number } {
  const currentParentAbs =
    currentParentId != null ? getAbsolutePosition(currentParentId, objects) : { x: 0, y: 0 };
  const absX = currentParentAbs.x + dropX;
  const absY = currentParentAbs.y + dropY;
  if (newParentId === null) {
    return { x: absX, y: absY };
  }
  const newParentAbs = getAbsolutePosition(newParentId, objects);
  return {
    x: absX - newParentAbs.x,
    y: absY - newParentAbs.y,
  };
}

/** Check if targetId is an ancestor of nodeId (would create cycle). */
export function wouldCreateCycle(
  nodeId: string,
  targetParentId: string,
  objects: Record<string, BoardObjectWithMeta>
): boolean {
  let current: string | null = targetParentId;
  while (current) {
    if (current === nodeId) return true;
    const obj: BoardObjectWithMeta | undefined = objects[current];
    current = obj?.parentId ?? null;
  }
  return false;
}

function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  padding = 0
): boolean {
  return (
    px >= rx - padding &&
    px <= rx + rw + padding &&
    py >= ry - padding &&
    py <= ry + rh + padding
  );
}

/** Padding (in board units) for drop-into-frame hit test - makes drops near edge more forgiving */
const DROP_HIT_PADDING = 8;

/**
 * Find the topmost (smallest/deepest) frame containing the given absolute point.
 * Returns frame id or null for board root.
 * Uses padding for drop targets so drops near the frame edge still register.
 */
export function findContainingFrame(
  absPoint: { x: number; y: number },
  objects: Record<string, BoardObjectWithMeta>,
  excludeNodeId?: string,
  options?: { padding?: number }
): string | null {
  const padding = options?.padding ?? DROP_HIT_PADDING;
  const frames: Array<{ id: string; area: number; depth: number }> = [];
  for (const obj of Object.values(objects) as BoardObjectWithMeta[]) {
    if (obj.type !== "frame" || obj.id === excludeNodeId) continue;
    const abs = getAbsolutePosition(obj.id, objects);
    if (!pointInRect(absPoint.x, absPoint.y, abs.x, abs.y, obj.width, obj.height, padding))
      continue;
    const area = obj.width * obj.height;
    let depth = 0;
    let p: string | null = obj.parentId ?? null;
    while (p) {
      depth++;
      p = objects[p]?.parentId ?? null;
    }
    frames.push({ id: obj.id, area, depth });
  }
  if (frames.length === 0) return null;
  frames.sort((a, b) => b.depth - a.depth || a.area - b.area);
  return frames[0]!.id;
}
