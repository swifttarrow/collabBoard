import { useBoardStore } from "@/lib/board/store";
import type { ViewportState } from "@/lib/board/types";
import { getAbsolutePosition } from "@/lib/board/scene-graph";

const DEFAULT_DURATION_MS = 280;
const MIN_SCALE = 0.15;
const MAX_SCALE = 2;

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
    scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, target.scale ?? start.scale)),
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
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));

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
  const scale = Math.max(
    MIN_SCALE,
    Math.min(FIND_ZOOM_MAX_SCALE, scaleX, scaleY)
  );

  const x = stageWidth / 2 - cx * scale;
  const y = stageHeight / 2 - cy * scale;

  animateViewport({ x, y, scale }, durationMs);
}
