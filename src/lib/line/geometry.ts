import type { BoardObject } from "@/lib/board/types";
import type { LineData, LineGeometry, AnchorKind } from "./types";
import { getAbsolutePosition } from "@/lib/board/scene-graph";

const RECT_ANCHOR_OFFSETS: Record<AnchorKind, { fx: number; fy: number }> = {
  "top": { fx: 0.25, fy: 0 },
  "top-mid": { fx: 0.75, fy: 0 },
  "right": { fx: 1, fy: 0.25 },
  "right-mid": { fx: 1, fy: 0.75 },
  "bottom": { fx: 0.75, fy: 1 },
  "bottom-mid": { fx: 0.25, fy: 1 },
  "left": { fx: 0, fy: 0.75 },
  "left-mid": { fx: 0, fy: 0.25 },
};

const CIRCLE_ANGLES: Record<AnchorKind, number> = {
  "top": -Math.PI / 2,
  "top-mid": -Math.PI / 4,
  "right": 0,
  "right-mid": Math.PI / 4,
  "bottom": Math.PI / 2,
  "bottom-mid": (3 * Math.PI) / 4,
  "left": Math.PI,
  "left-mid": (-3 * Math.PI) / 4,
};

const DEFAULT_ANCHOR: AnchorKind = "right-mid";

export function getAnchorPoint(
  shape: BoardObject,
  anchor: AnchorKind
): { x: number; y: number } {
  const { x, y, width, height } = shape;
  const type = shape.type as string;

  if (type === "circle") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2;
    const angle = CIRCLE_ANGLES[anchor];
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const { fx, fy } = RECT_ANCHOR_OFFSETS[anchor];
  return {
    x: x + width * fx,
    y: y + height * fy,
  };
}

export function getShapeAnchors(
  shape: BoardObject
): Array<{ anchor: AnchorKind; x: number; y: number }> {
  return (Object.keys(RECT_ANCHOR_OFFSETS) as AnchorKind[]).map((anchor) => {
    const pt = getAnchorPoint(shape, anchor);
    return { anchor, ...pt };
  });
}

/** Anchor point in absolute (board) coordinates for hierarchy-aware connectors. */
export function getAbsoluteAnchorPoint(
  shapeId: string,
  anchor: AnchorKind,
  objects: Record<string, BoardObject & { parentId?: string | null }>
): { x: number; y: number } {
  const shape = objects[shapeId];
  if (!shape) return { x: 0, y: 0 };
  const localPt = getAnchorPoint(shape, anchor);
  const parentId = shape.parentId ?? null;
  const parentAbs = parentId
    ? getAbsolutePosition(parentId, objects)
    : { x: 0, y: 0 };
  return {
    x: parentAbs.x + localPt.x,
    y: parentAbs.y + localPt.y,
  };
}

/**
 * Compute line geometry in absolute (board) coordinates. Uses getAbsoluteAnchorPoint
 * for connected shapes so connectors work with shapes inside frames.
 */
export function getLineGeometry(
  line: BoardObject & { type: "line"; data?: LineData; parentId?: string | null },
  objects: Record<string, BoardObject & { parentId?: string | null }>
): LineGeometry {
  const data = line.data ?? {};
  const hasStartShape = !!data.startShapeId && !!objects[data.startShapeId];
  const hasEndShape = !!data.endShapeId && !!objects[data.endShapeId];
  const lineAbs = getAbsolutePosition(line.id, objects);

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  if (hasStartShape) {
    const pt = getAbsoluteAnchorPoint(
      data.startShapeId!,
      (data.startAnchor ?? DEFAULT_ANCHOR) as AnchorKind,
      objects
    );
    startX = pt.x;
    startY = pt.y;
  } else {
    startX = data.startX ?? lineAbs.x;
    startY = data.startY ?? lineAbs.y;
  }

  if (hasEndShape) {
    const pt = getAbsoluteAnchorPoint(
      data.endShapeId!,
      (data.endAnchor ?? DEFAULT_ANCHOR) as AnchorKind,
      objects
    );
    endX = pt.x;
    endY = pt.y;
  } else {
    const x2 = data.endX ?? data.x2 ?? line.x;
    const y2 = data.endY ?? data.y2 ?? line.y;
    endX = lineAbs.x + (x2 - line.x);
    endY = lineAbs.y + (y2 - line.y);
  }

  return {
    startX,
    startY,
    endX,
    endY,
    points: [{ x: startX, y: startY }, { x: endX, y: endY }],
  };
}

export function geometryToLinePoints(geom: LineGeometry): number[] {
  const out: number[] = [];
  for (const p of geom.points) {
    out.push(p.x - geom.startX, p.y - geom.startY);
  }
  return out;
}
