import type { BoardObject } from "@/lib/board/types";
import type {
  ConnectorEndpoint,
  ConnectorAnchor,
  AttachedEndpoint,
  RoutingMode,
} from "./connector-types";
import type { LineData, LineGeometry, AnchorKind } from "./types";
import { getAbsolutePosition } from "@/lib/board/scene-graph";

const RECT_ANCHOR_OFFSETS: Record<AnchorKind, { fx: number; fy: number }> = {
  "top": { fx: 0.25, fy: 0 },
  "top-mid": { fx: 0.5, fy: 0 },
  "right": { fx: 1, fy: 0.25 },
  "right-mid": { fx: 1, fy: 0.5 },
  "bottom": { fx: 0.75, fy: 1 },
  "bottom-mid": { fx: 0.5, fy: 1 },
  "left": { fx: 0, fy: 0.75 },
  "left-mid": { fx: 0, fy: 0.5 },
  "line-start": { fx: 0, fy: 0.5 },
  "line-end": { fx: 1, fy: 0.5 },
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
  "line-start": 0,
  "line-end": Math.PI,
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
  shape: BoardObject,
  objects?: Record<string, BoardObject & { parentId?: string | null }>
): Array<{ anchor: AnchorKind; x: number; y: number }> {
  if (shape.type === "line" && objects) {
    const geom = getLineGeometry(
      shape as BoardObject & { type: "line"; data?: LineData; parentId?: string | null },
      objects
    );
    return [
      { anchor: "line-start" as AnchorKind, x: geom.startX, y: geom.startY },
      { anchor: "line-end" as AnchorKind, x: geom.endX, y: geom.endY },
    ];
  }
  const anchorKinds = Object.keys(RECT_ANCHOR_OFFSETS) as AnchorKind[];
  if (objects) {
    return anchorKinds.map((anchor) => {
      const pt = getAbsoluteAnchorPoint(shape.id, anchor, objects);
      return { anchor, ...pt };
    });
  }
  return anchorKinds.map((anchor) => {
    const pt = getAnchorPoint(shape, anchor);
    return { anchor, ...pt };
  });
}

/** Map AnchorKind to spec ConnectorAnchor (side + offset). */
export function anchorKindToConnectorAnchor(kind: AnchorKind): ConnectorAnchor {
  const map: Record<AnchorKind, ConnectorAnchor> = {
    "top": { type: "side", side: "top", offset: 0.25 },
    "top-mid": { type: "side", side: "top", offset: 0.5 },
    "right": { type: "side", side: "right", offset: 0.25 },
    "right-mid": { type: "side", side: "right", offset: 0.5 },
    "bottom": { type: "side", side: "bottom", offset: 0.75 },
    "bottom-mid": { type: "side", side: "bottom", offset: 0.5 },
    "left": { type: "side", side: "left", offset: 0.75 },
    "left-mid": { type: "side", side: "left", offset: 0.5 },
    "line-start": { type: "line-endpoint", which: "start" },
    "line-end": { type: "line-endpoint", which: "end" },
  };
  return map[kind];
}

/** Resolve spec ConnectorAnchor to local point on shape. */
function resolveAnchor(
  shape: BoardObject,
  anchor: ConnectorAnchor
): { x: number; y: number } {
  const { x, y, width, height } = shape;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const type = shape.type as string;

  switch (anchor.type) {
    case "center":
      return { x: cx, y: cy };
    case "point":
      return { x: x + anchor.x * width, y: y + anchor.y * height };
    case "side": {
      const o = anchor.offset;
      switch (anchor.side) {
        case "top":
          return { x: x + width * o, y };
        case "right":
          return { x: x + width, y: y + height * o };
        case "bottom":
          return { x: x + width * (1 - o), y: y + height };
        case "left":
          return { x, y: y + height * (1 - o) };
        default:
          return { x: cx, y: cy };
      }
    }
    case "perimeter": {
      if (type === "circle") {
        const r = Math.min(width, height) / 2;
        const angle = anchor.position * 2 * Math.PI - Math.PI / 2;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      }
      const perim = anchor.position;
      const w2 = width * 2;
      const h2 = height * 2;
      const total = w2 + h2;
      if (perim * total <= width) {
        return { x: x + perim * total, y };
      }
      if (perim * total <= width + height) {
        return { x: x + width, y: y + (perim * total - width) };
      }
      if (perim * total <= width * 2 + height) {
        return { x: x + width - (perim * total - width - height), y: y + height };
      }
      return { x, y: y + height - (perim * total - width * 2 - height) };
    }
    default:
      return { x: cx, y: cy };
  }
}

export type ResolveEndpointOptions = {
  /** When endpoint is attached to this line (self-ref, invalid), use fallback instead of recursing */
  excludeLineId?: string;
  fallback?: { x: number; y: number };
};

/** Resolve ConnectorEndpoint to absolute board point. */
export function resolveConnectorEndpoint(
  endpoint: ConnectorEndpoint,
  objects: Record<string, BoardObject & { parentId?: string | null }>,
  options?: ResolveEndpointOptions
): { x: number; y: number } {
  if (endpoint.type === "free") {
    return { x: endpoint.x, y: endpoint.y };
  }
  const ep = endpoint as AttachedEndpoint;
  const shape = objects[ep.nodeId];
  if (!shape) return options?.fallback ?? { x: 0, y: 0 };
  if (
    shape.type === "line" &&
    ep.anchor.type === "line-endpoint"
  ) {
    if (options?.excludeLineId && ep.nodeId === options.excludeLineId) {
      return options.fallback ?? { x: 0, y: 0 };
    }
    const geom = getLineGeometry(
      shape as BoardObject & { type: "line"; data?: LineData; parentId?: string | null },
      objects
    );
    return ep.anchor.which === "start"
      ? { x: geom.startX, y: geom.startY }
      : { x: geom.endX, y: geom.endY };
  }
  const local = resolveAnchor(shape, ep.anchor);
  const parentId = shape.parentId ?? null;
  const parentAbs = parentId
    ? getAbsolutePosition(parentId, objects)
    : { x: 0, y: 0 };
  return {
    x: parentAbs.x + local.x,
    y: parentAbs.y + local.y,
  };
}

/** Anchor point in absolute (board) coordinates for hierarchy-aware connectors. */
export function getAbsoluteAnchorPoint(
  shapeId: string,
  anchor: AnchorKind,
  objects: Record<string, BoardObject & { parentId?: string | null }>
): { x: number; y: number } {
  const shape = objects[shapeId];
  if (!shape) return { x: 0, y: 0 };
  if (shape.type === "line" && (anchor === "line-start" || anchor === "line-end")) {
    const geom = getLineGeometry(
      shape as BoardObject & { type: "line"; data?: LineData; parentId?: string | null },
      objects
    );
    return anchor === "line-start"
      ? { x: geom.startX, y: geom.startY }
      : { x: geom.endX, y: geom.endY };
  }
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
 * Orthogonal (Manhattan) routing. First segment exits perpendicular to the
 * dominant direction toward the end, so arrowheads at the node junction
 * point correctly "into" the node (e.g. arrow at bottom attachment points up).
 */
function computeOrthogonalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> {
  const dx = endX - startX;
  const dy = endY - startY;
  const midX = startX + dx / 2;
  const midY = startY + dy / 2;
  if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
    return [{ x: startX, y: startY }, { x: endX, y: endY }];
  }
  // First segment perpendicular to dominant axis: if end is more vertically
  // aligned (|dy| >= |dx|), exit vertically first so arrow points into node.
  if (Math.abs(dy) >= Math.abs(dx)) {
    return [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY },
    ];
  }
  return [
    { x: startX, y: startY },
    { x: midX, y: startY },
    { x: midX, y: endY },
    { x: endX, y: endY },
  ];
}

/** Curved routing: simple Bezier with control points. */
function computeCurvedPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy) || 1;
  const curvature = Math.min(dist * 0.4, 60);
  const c1x = startX + curvature;
  const c1y = startY;
  const c2x = endX - curvature;
  const c2y = endY;
  return [
    { x: startX, y: startY },
    { x: c1x, y: c1y },
    { x: c2x, y: c2y },
    { x: endX, y: endY },
  ];
}

/** Compute path points from start/end based on routing mode. */
function computePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  mode: RoutingMode
): Array<{ x: number; y: number }> {
  switch (mode) {
    case "orthogonal":
      return computeOrthogonalPath(startX, startY, endX, endY);
    case "curved":
      return computeCurvedPath(startX, startY, endX, endY);
    case "straight":
    default:
      return [
        { x: startX, y: startY },
        { x: endX, y: endY },
      ];
  }
}

/**
 * Compute line geometry in absolute (board) coordinates. Supports both legacy
 * (startShapeId/endShapeId) and new connector endpoint formats. Path is derived
 * from routing mode.
 */
export function getLineGeometry(
  line: BoardObject & { type: "line"; data?: LineData; parentId?: string | null },
  objects: Record<string, BoardObject & { parentId?: string | null }>
): LineGeometry {
  const data = line.data ?? {};
  const routingMode = (data.routingMode ?? "orthogonal") as RoutingMode;
  const lineAbs = getAbsolutePosition(line.id, objects);

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  // Resolve end first (needed when start is self-attached and we use end as fallback)
  if (data.end?.type === "attached") {
    const pt = resolveConnectorEndpoint(data.end, objects, {
      excludeLineId: line.id,
      fallback: { x: lineAbs.x + 80, y: lineAbs.y },
    });
    endX = pt.x;
    endY = pt.y;
  } else if (data.end?.type === "free") {
    endX = data.end.x;
    endY = data.end.y;
  } else {
    const hasEndShape = !!data.endShapeId && !!objects[data.endShapeId];
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
  }

  if (data.start?.type === "attached") {
    const pt = resolveConnectorEndpoint(data.start, objects, {
      excludeLineId: line.id,
      fallback: { x: endX - 80, y: endY },
    });
    startX = pt.x;
    startY = pt.y;
  } else if (data.start?.type === "free") {
    startX = data.start.x;
    startY = data.start.y;
  } else {
    const hasStartShape = !!data.startShapeId && !!objects[data.startShapeId];
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
  }

  const points = computePath(startX, startY, endX, endY, routingMode);

  return {
    startX,
    startY,
    endX,
    endY,
    points,
  };
}

/** Flatten path to Konva line points (x1,y1,x2,y2,...). For curves we sample the Bezier. */
export function geometryToLinePoints(geom: LineGeometry): number[] {
  const out: number[] = [];
  for (const p of geom.points) {
    out.push(p.x - geom.startX, p.y - geom.startY);
  }
  return out;
}

/** Get Konva-compatible points for Line/Arrow. Curved paths need sampled Bezier. */
export function geometryToKonvaPoints(
  geom: LineGeometry,
  routingMode: RoutingMode = "straight"
): number[] {
  if (geom.points.length <= 2 || routingMode !== "curved") {
    return geometryToLinePoints(geom);
  }
  const [p0, c1, c2, p3] = geom.points;
  if (!p0 || !c1 || !c2 || !p3) return geometryToLinePoints(geom);
  const samples: Array<{ x: number; y: number }> = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * p3.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * p3.y;
    samples.push({ x: x - geom.startX, y: y - geom.startY });
  }
  const out: number[] = [];
  for (const p of samples) {
    out.push(p.x, p.y);
  }
  return out;
}

/** Connector-attachable node types. Includes lines (connectors attach to line endpoints). */
const CONNECTABLE_TYPES = [
  "rect",
  "circle",
  "sticky",
  "text",
  "frame",
  "sticker",
  "line",
] as const;

/**
 * Find the nearest attachable node and anchor at the given point.
 * Returns null if none within snapRadius.
 */
export function findNearestNodeAndAnchor(
  point: { x: number; y: number },
  objects: Record<string, BoardObject & { parentId?: string | null }>,
  excludeId?: string,
  snapRadius = 10
): { nodeId: string; anchor: AnchorKind; dist: number } | null {
  let best: { nodeId: string; anchor: AnchorKind; dist: number } | null = null;

  for (const obj of Object.values(objects)) {
    if (obj.id === excludeId) continue;
    if (!CONNECTABLE_TYPES.includes(obj.type as (typeof CONNECTABLE_TYPES)[number]))
      continue;

    const anchors = getShapeAnchors(obj, objects);
    for (const { anchor } of anchors) {
      const pt = getAbsoluteAnchorPoint(obj.id, anchor, objects);
      const dist = Math.hypot(point.x - pt.x, point.y - pt.y);
      if (dist <= snapRadius && (!best || dist < best.dist)) {
        best = { nodeId: obj.id, anchor, dist };
      }
    }
    if (obj.type !== "line") {
      const abs = getAbsolutePosition(obj.id, objects);
      const w = (obj as { width: number }).width ?? 0;
      const h = (obj as { height: number }).height ?? 0;
      const cx = abs.x + w / 2;
      const cy = abs.y + h / 2;
      const centerDist = Math.hypot(point.x - cx, point.y - cy);
      if (centerDist <= snapRadius && (!best || centerDist < best.dist)) {
        best = { nodeId: obj.id, anchor: "right-mid", dist: centerDist };
      }
    }
  }
  return best;
}

/**
 * Get connector (line) IDs that have any endpoint attached to the given node.
 */
export function getConnectorsAttachedToNode(
  nodeId: string,
  objects: Record<string, BoardObject & { parentId?: string | null; type?: string }>
): string[] {
  const ids: string[] = [];
  for (const obj of Object.values(objects)) {
    if (obj.type !== "line") continue;
    const d = (obj.data ?? {}) as {
      start?: { type: string; nodeId?: string };
      end?: { type: string; nodeId?: string };
      startShapeId?: string;
      endShapeId?: string;
    };
    const startNode = d.start?.type === "attached" ? d.start.nodeId : d.startShapeId;
    const endNode = d.end?.type === "attached" ? d.end.nodeId : d.endShapeId;
    if (startNode === nodeId || endNode === nodeId) {
      ids.push(obj.id);
    }
  }
  return ids;
}
