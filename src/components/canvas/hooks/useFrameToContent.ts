"use client";

import { useEffect, useCallback } from "react";
import { useBoardStore } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { animateViewport } from "@/lib/viewport/tools";

export const FRAME_TO_CONTENT_EVENT = "collabboard:frame-to-content";

/** After find zoom, suppress frame-to-content for a short window so it doesn't overwrite. */
const FIND_ZOOM_SUPPRESS_MS = 800;
let lastFindZoomAt = 0;
export function setSuppressNextFrameToContent() {
  lastFindZoomAt = Date.now();
}

const PADDING = 80;
const MIN_SCALE = 0.15;
const MAX_SCALE = 2;

function getBoundingBox(
  objects: Record<string, BoardObjectWithMeta>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const entries = Object.values(objects);
  if (entries.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") {
      const x2 = (obj.data as { x2?: number })?.x2 ?? 0;
      const y2 = (obj.data as { y2?: number })?.y2 ?? 0;
      const abs2 = { x: abs.x + x2, y: abs.y + y2 };
      minX = Math.min(minX, abs.x, abs2.x);
      minY = Math.min(minY, abs.y, abs2.y);
      maxX = Math.max(maxX, abs.x, abs2.x);
      maxY = Math.max(maxY, abs.y, abs2.y);
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

  if (minX === Infinity || minY === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Listens for FRAME_TO_CONTENT_EVENT and adjusts viewport to fit all objects.
 * Called after AI commands create or move content.
 * Skips when skipWhen is true (e.g. user is following someone).
 */
export function useFrameToContent(boardId: string, skipWhen = false) {
  const objects = useBoardStore((s) => s.objects);

  const frameToContent = useCallback(
    (stageWidth: number, stageHeight: number) => {
      const bbox = getBoundingBox(objects);
      if (!bbox) return;

      const { minX, minY, maxX, maxY } = bbox;
      const contentW = maxX - minX;
      const contentH = maxY - minY;

      const effectiveW = Math.max(1, stageWidth - 2 * PADDING);
      const effectiveH = Math.max(1, stageHeight - 2 * PADDING);

      const scaleX = effectiveW / Math.max(contentW, 100);
      const scaleY = effectiveH / Math.max(contentH, 100);
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleX, scaleY));

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const x = stageWidth / 2 - cx * scale;
      const y = stageHeight / 2 - cy * scale;

      animateViewport({ x, y, scale });
    },
    [boardId, objects]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      if (skipWhen) return;
      if (Date.now() - lastFindZoomAt < FIND_ZOOM_SUPPRESS_MS) {
        return;
      }
      const detail = (e as CustomEvent<{ boardId: string }>).detail;
      if (detail?.boardId !== boardId) return;

      const stageWidth = window.innerWidth;
      const stageHeight = window.innerHeight;
      frameToContent(stageWidth, stageHeight);
    };
    window.addEventListener(FRAME_TO_CONTENT_EVENT, handler);
    return () => window.removeEventListener(FRAME_TO_CONTENT_EVENT, handler);
  }, [boardId, frameToContent, skipWhen]);
}
