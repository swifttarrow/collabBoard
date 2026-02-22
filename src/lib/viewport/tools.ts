import { useBoardStore } from "@/lib/board/store";
import type { ViewportState } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { getLineGeometry } from "@/lib/line/geometry";

const DEFAULT_DURATION_MS = 160;
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

/** Zoom presets as percentages (12.5, 25, ..., 800) */
export const ZOOM_PRESETS = [12.5, 25, 50, 75, 100, 125, 150, 200, 300, 400, 800];

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function getNextPreset(currentScale: number, direction: 1 | -1): number {
  const currentPercent = currentScale * 100;
  const sorted = [...ZOOM_PRESETS].sort((a, b) => a - b);
  if (direction > 0) {
    const next = sorted.find((p) => p > currentPercent);
    return (next ?? sorted[sorted.length - 1]!) / 100;
  }
  const prev = [...sorted].reverse().find((p) => p < currentPercent);
  return (prev ?? sorted[0]!) / 100;
}

let animationFrameId: number | null = null;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Animate viewport to a target state over a duration.
 * Callable from anywhere (e.g. frame-to-content, zoom buttons).
 * Cancels any in-progress animation.
 */
export function animateViewport(
  target: Partial<ViewportState>,
  durationMs = DEFAULT_DURATION_MS
): void {
  if (animationFrameId != null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  const { viewport, setViewport } = useBoardStore.getState();
  const start = { ...viewport };
  const end = {
    x: target.x ?? start.x,
    y: target.y ?? start.y,
    scale: clampScale(target.scale ?? start.scale),
  };

  const startTime = performance.now();

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeOutCubic(t);

    setViewport({
      x: lerp(start.x, end.x, eased),
      y: lerp(start.y, end.y, eased),
      scale: lerp(start.scale, end.scale, eased),
    });

    if (t < 1) {
      animationFrameId = requestAnimationFrame(tick);
    } else {
      animationFrameId = null;
    }
  };

  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Pan viewport by a delta, animated.
 */
export function animatePan(
  deltaX: number,
  deltaY: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport, setViewport } = useBoardStore.getState();
  animateViewport(
    {
      x: viewport.x + deltaX,
      y: viewport.y + deltaY,
      scale: viewport.scale,
    },
    durationMs
  );
}

/**
 * Zoom viewport toward a screen-space center point.
 * @param centerScreenX - screen x of zoom center (e.g. pointer)
 * @param centerScreenY - screen y of zoom center
 * @param targetScale - desired scale factor
 */
export function animateZoom(
  centerScreenX: number,
  centerScreenY: number,
  targetScale: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport, setViewport } = useBoardStore.getState();
  const scale = clampScale(targetScale);

  // World point under center stays fixed
  const worldX = (centerScreenX - viewport.x) / viewport.scale;
  const worldY = (centerScreenY - viewport.y) / viewport.scale;
  const newX = centerScreenX - worldX * scale;
  const newY = centerScreenY - worldY * scale;

  animateViewport({ x: newX, y: newY, scale }, durationMs);
}

/**
 * Zoom in/out by a factor (e.g. 1.1 = 10% in) toward center of stage.
 */
export function animateZoomBy(
  factor: number,
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport } = useBoardStore.getState();
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;
  animateZoom(centerX, centerY, viewport.scale * factor, durationMs);
}

const OBJECT_PADDING = 80;
const TARGET_OBJECT_SCREEN_FRACTION = 0.7;
/** Higher max for find—we want the object to fill most of the viewport. */
const FIND_ZOOM_MAX_SCALE = 6;

/**
 * Center viewport on an object and zoom in so it's prominent.
 * Used when finding/selecting an object.
 */
export function animateViewportToObject(
  objectId: string,
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { objects, setViewport } = useBoardStore.getState();
  const obj = objects[objectId];
  if (!obj) return;

  const abs = getAbsolutePosition(objectId, objects);
  let minX: number, minY: number, maxX: number, maxY: number;

  if (obj.type === "line") {
    const x2 = (obj.data as { x2?: number })?.x2 ?? 0;
    const y2 = (obj.data as { y2?: number })?.y2 ?? 0;
    minX = Math.min(abs.x, abs.x + x2);
    minY = Math.min(abs.y, abs.y + y2);
    maxX = Math.max(abs.x, abs.x + x2);
    maxY = Math.max(abs.y, abs.y + y2);
  } else if (obj.width != null && obj.height != null) {
    minX = abs.x;
    minY = abs.y;
    maxX = abs.x + obj.width;
    maxY = abs.y + obj.height;
  } else {
    minX = abs.x;
    minY = abs.y;
    maxX = abs.x;
    maxY = abs.y;
  }

  const contentW = Math.max(maxX - minX, 60);
  const contentH = Math.max(maxY - minY, 40);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const effectiveW = stageWidth * TARGET_OBJECT_SCREEN_FRACTION - 2 * OBJECT_PADDING;
  const effectiveH = stageHeight * TARGET_OBJECT_SCREEN_FRACTION - 2 * OBJECT_PADDING;
  const scaleX = effectiveW / contentW;
  const scaleY = effectiveH / contentH;
  const   scale = clampScale(Math.min(FIND_ZOOM_MAX_SCALE, scaleX, scaleY));

  const x = stageWidth / 2 - cx * scale;
  const y = stageHeight / 2 - cy * scale;

  animateViewport({ x, y, scale }, durationMs);
}

/** Compute bounding box of all visible content in world coordinates. */
function computeContentBounds(
  objects: Record<string, BoardObjectWithMeta>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const entries = Object.values(objects);
  if (entries.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of entries) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") {
      const geom = getLineGeometry(
        obj as BoardObjectWithMeta & { type: "line"; data?: Record<string, unknown> },
        objects
      );
      const pts = geom.points ?? [
        { x: geom.startX, y: geom.startY },
        { x: geom.endX, y: geom.endY },
      ];
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    } else if (obj.width != null && obj.height != null) {
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + obj.width);
      maxY = Math.max(maxY, abs.y + obj.height);
    } else {
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x);
      maxY = Math.max(maxY, abs.y);
    }
  }

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

const FIT_PADDING_FRACTION = 0.12; // ~12% padding
const MIN_FIT_PADDING_PX = 40;

/**
 * Zoom to fit a subset of objects in the viewport.
 * Uses same padding as zoomToFit. If objectIds empty or invalid, no-op.
 */
export function zoomToFitObjects(
  objectIds: string[],
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { objects } = useBoardStore.getState();
  const subset: Record<string, BoardObjectWithMeta> = {};
  for (const id of objectIds) {
    const obj = objects[id];
    if (obj) subset[id] = obj;
  }
  if (Object.keys(subset).length === 0) return;

  const bounds = computeContentBounds(subset);
  if (!bounds || bounds.minX === bounds.maxX) return;

  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const paddingX = Math.max(MIN_FIT_PADDING_PX, stageWidth * FIT_PADDING_FRACTION);
  const paddingY = Math.max(MIN_FIT_PADDING_PX, stageHeight * FIT_PADDING_FRACTION);
  const availableW = stageWidth - 2 * paddingX;
  const availableH = stageHeight - 2 * paddingY;

  const scaleX = availableW / contentW;
  const scaleY = availableH / contentH;
  const scale = clampScale(Math.min(scaleX, scaleY));

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const x = stageWidth / 2 - cx * scale;
  const y = stageHeight / 2 - cy * scale;

  animateViewport({ x, y, scale }, durationMs);
}

/**
 * Zoom to fit all content in the viewport with padding.
 * Empty canvas: reset to 100% and center origin.
 */
export function zoomToFit(
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { objects, viewport, setViewport } = useBoardStore.getState();
  const bounds = computeContentBounds(objects);

  if (!bounds || bounds.minX === bounds.maxX) {
    // Empty or point: reset to 100% and center
    animateViewport({ x: stageWidth / 2, y: stageHeight / 2, scale: 1 }, durationMs);
    return;
  }

  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const paddingX = Math.max(MIN_FIT_PADDING_PX, stageWidth * FIT_PADDING_FRACTION);
  const paddingY = Math.max(MIN_FIT_PADDING_PX, stageHeight * FIT_PADDING_FRACTION);
  const availableW = stageWidth - 2 * paddingX;
  const availableH = stageHeight - 2 * paddingY;

  const scaleX = availableW / contentW;
  const scaleY = availableH / contentH;
  const scale = clampScale(Math.min(scaleX, scaleY));

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const x = stageWidth / 2 - cx * scale;
  const y = stageHeight / 2 - cy * scale;

  animateViewport({ x, y, scale }, durationMs);
}

/**
 * Zoom in to next preset (center-anchored).
 */
export function zoomInPreset(
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport } = useBoardStore.getState();
  const nextScale = getNextPreset(viewport.scale, 1);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;
  animateZoom(centerX, centerY, nextScale, durationMs);
}

/**
 * Zoom out to previous preset (center-anchored).
 */
export function zoomOutPreset(
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport } = useBoardStore.getState();
  const prevScale = getNextPreset(viewport.scale, -1);
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;
  animateZoom(centerX, centerY, prevScale, durationMs);
}

/**
 * Set zoom to a specific percentage (center-anchored by default).
 */
export function setZoomPercent(
  percent: number,
  stageWidth: number,
  stageHeight: number,
  anchor: "center" | "pointer" = "center",
  anchorPoint?: { x: number; y: number },
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport } = useBoardStore.getState();
  const scale = clampScale(percent / 100);

  const cx = anchor === "pointer" && anchorPoint
    ? anchorPoint.x
    : stageWidth / 2;
  const cy = anchor === "pointer" && anchorPoint
    ? anchorPoint.y
    : stageHeight / 2;

  animateZoom(cx, cy, scale, durationMs);
}

/**
 * Reset zoom to 100% (center-anchored).
 */
export function resetZoom(
  stageWidth: number,
  stageHeight: number,
  durationMs = DEFAULT_DURATION_MS
): void {
  setZoomPercent(100, stageWidth, stageHeight, "center", undefined, durationMs);
}

/**
 * Pan so a world point is centered in the viewport, and clamp zoom to min/max.
 * @param worldX - world X of point to center
 * @param worldY - world Y of point to center
 * @param minZoomPercent - minimum zoom (default 50 = 50%)
 * @param maxZoomPercent - maximum zoom (default 100 = 100%)
 */
export function zoomToPoint(
  worldX: number,
  worldY: number,
  stageWidth: number,
  stageHeight: number,
  minZoomPercent = 50,
  maxZoomPercent = 100,
  durationMs = DEFAULT_DURATION_MS
): void {
  const { viewport } = useBoardStore.getState();
  const minScale = minZoomPercent / 100;
  const maxScale = maxZoomPercent / 100;
  let scale = viewport.scale;
  if (scale < minScale) scale = minScale;
  if (scale > maxScale) scale = maxScale;
  scale = clampScale(scale);

  const x = stageWidth / 2 - worldX * scale;
  const y = stageHeight / 2 - worldY * scale;

  animateViewport({ x, y, scale }, durationMs);
}

export { MIN_SCALE, MAX_SCALE };
