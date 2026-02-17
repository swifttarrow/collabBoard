import { useRef, useState } from "react";
import type Konva from "konva";

type RectBounds = { x: number; y: number; width: number; height: number };

type UseRectDrawParams = {
  active: boolean;
  defaultRect: { width: number; height: number };
  getWorldPoint: (stage: Konva.Stage, pointer: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onCreateRect: (bounds: RectBounds) => void;
  onFinish: () => void;
  onClearSelection: () => void;
};

export function useRectDraw({
  active,
  defaultRect,
  getWorldPoint,
  onCreateRect,
  onFinish,
  onClearSelection,
}: UseRectDrawParams) {
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftRect, setDraftRect] = useState<RectBounds | null>(null);

  function start(stage: Konva.Stage) {
    if (!active) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const worldPoint = getWorldPoint(stage, pointer);
    onClearSelection();
    setIsDrawing(true);
    drawStartRef.current = worldPoint;
    setDraftRect({ x: worldPoint.x, y: worldPoint.y, width: 0, height: 0 });
  }

  function move(stage: Konva.Stage) {
    if (!isDrawing) return;
    const pointer = stage.getPointerPosition();
    const start = drawStartRef.current;
    if (!pointer || !start) return;
    const worldPoint = getWorldPoint(stage, pointer);
    const nextX = Math.min(start.x, worldPoint.x);
    const nextY = Math.min(start.y, worldPoint.y);
    const nextWidth = Math.abs(worldPoint.x - start.x);
    const nextHeight = Math.abs(worldPoint.y - start.y);
    setDraftRect({
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    });
  }

  function finish() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const start = drawStartRef.current;
    const draft = draftRect;
    drawStartRef.current = null;
    setDraftRect(null);
    if (!start) return;
    if (draft && draft.width > 6 && draft.height > 6) {
      onCreateRect(draft);
    } else {
      onCreateRect({
        x: start.x - defaultRect.width / 2,
        y: start.y - defaultRect.height / 2,
        width: defaultRect.width,
        height: defaultRect.height,
      });
    }
    onFinish();
  }

  function cancel() {
    if (!isDrawing) return;
    setIsDrawing(false);
    drawStartRef.current = null;
    setDraftRect(null);
    onFinish();
  }

  return {
    draftRect,
    isDrawing,
    start,
    move,
    finish,
    cancel,
  };
}
