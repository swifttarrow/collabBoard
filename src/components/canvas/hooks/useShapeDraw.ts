import { useRef, useState } from "react";
import type Konva from "konva";
import type { ShapeTool } from "@/components/canvas/CanvasToolbar";

type RectBounds = { x: number; y: number; width: number; height: number };
type LineBounds = { x1: number; y1: number; x2: number; y2: number };

/** ShapeTool plus frame and line for drawing. */
type ShapeDrawTool = ShapeTool | "frame" | "line";

type UseShapeDrawParams = {
  active: boolean;
  shapeTool: ShapeDrawTool;
  defaultRect: { width: number; height: number };
  defaultCircle: { width: number; height: number };
  defaultFrame: { width: number; height: number };
  defaultLineLength: number;
  getWorldPoint: (stage: Konva.Stage, pointer: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onCreateRect: (bounds: RectBounds) => void;
  onCreateCircle: (bounds: RectBounds) => void;
  onCreateFrame: (bounds: RectBounds) => void;
  onCreateLine: (bounds: LineBounds) => void;
  onFinish: () => void;
  onClearSelection: () => void;
};

export type DraftShape =
  | { type: "rect"; bounds: RectBounds }
  | { type: "circle"; bounds: RectBounds }
  | { type: "frame"; bounds: RectBounds }
  | { type: "line"; bounds: LineBounds };

export function useShapeDraw({
  active,
  shapeTool,
  defaultRect,
  defaultCircle,
  defaultFrame,
  defaultLineLength,
  getWorldPoint,
  onCreateRect,
  onCreateCircle,
  onCreateFrame,
  onCreateLine,
  onFinish,
  onClearSelection,
}: UseShapeDrawParams) {
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftShape, setDraftShape] = useState<DraftShape | null>(null);

  function start(stage: Konva.Stage) {
    if (!active) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const worldPoint = getWorldPoint(stage, pointer);
    onClearSelection();
    setIsDrawing(true);
    drawStartRef.current = worldPoint;

    if (shapeTool === "line") {
      setDraftShape({
        type: "line",
        bounds: {
          x1: worldPoint.x,
          y1: worldPoint.y,
          x2: worldPoint.x,
          y2: worldPoint.y,
        },
      });
    } else {
      const draftType =
        shapeTool === "frame" ? "frame" : shapeTool === "circle" ? "circle" : "rect";
      setDraftShape({
        type: draftType,
        bounds: { x: worldPoint.x, y: worldPoint.y, width: 0, height: 0 },
      });
    }
  }

  function move(stage: Konva.Stage) {
    if (!isDrawing) return;
    const pointer = stage.getPointerPosition();
    const start = drawStartRef.current;
    if (!pointer || !start) return;
    const worldPoint = getWorldPoint(stage, pointer);

    if (shapeTool === "line") {
      setDraftShape({
        type: "line",
        bounds: {
          x1: start.x,
          y1: start.y,
          x2: worldPoint.x,
          y2: worldPoint.y,
        },
      });
    } else {
      const nextX = Math.min(start.x, worldPoint.x);
      const nextY = Math.min(start.y, worldPoint.y);
      const nextWidth = Math.abs(worldPoint.x - start.x);
      const nextHeight = Math.abs(worldPoint.y - start.y);
      const draftType =
        shapeTool === "frame" ? "frame" : shapeTool === "circle" ? "circle" : "rect";
      setDraftShape({
        type: draftType,
        bounds: { x: nextX, y: nextY, width: nextWidth, height: nextHeight },
      });
    }
  }

  function finish() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const start = drawStartRef.current;
    const draft = draftShape;
    drawStartRef.current = null;
    setDraftShape(null);
    if (!start) return;

    if (shapeTool === "line") {
      const line = draft?.type === "line" ? draft.bounds : null;
      const len = line ? Math.hypot(line.x2 - line.x1, line.y2 - line.y1) : 0;
      if (line && len >= 6) {
        onCreateLine(line);
      } else {
        onCreateLine({
          x1: start.x,
          y1: start.y,
          x2: start.x + defaultLineLength,
          y2: start.y,
        });
      }
    } else if (shapeTool === "rect") {
      const rect = draft?.type === "rect" ? draft.bounds : null;
      if (rect && rect.width > 6 && rect.height > 6) {
        onCreateRect(rect);
      } else {
        onCreateRect({
          x: start.x - defaultRect.width / 2,
          y: start.y - defaultRect.height / 2,
          width: defaultRect.width,
          height: defaultRect.height,
        });
      }
    } else if (shapeTool === "frame") {
      const frame = draft?.type === "frame" ? draft.bounds : null;
      if (frame && frame.width > 6 && frame.height > 6) {
        onCreateFrame(frame);
      } else {
        onCreateFrame({
          x: start.x - defaultFrame.width / 2,
          y: start.y - defaultFrame.height / 2,
          width: defaultFrame.width,
          height: defaultFrame.height,
        });
      }
    } else if (shapeTool === "circle") {
      const circle = draft?.type === "circle" ? draft.bounds : null;
      if (circle && circle.width > 6 && circle.height > 6) {
        const size = Math.max(circle.width, circle.height);
        const cx = circle.x + circle.width / 2;
        const cy = circle.y + circle.height / 2;
        onCreateCircle({
          x: cx - size / 2,
          y: cy - size / 2,
          width: size,
          height: size,
        });
      } else {
        onCreateCircle({
          x: start.x - defaultCircle.width / 2,
          y: start.y - defaultCircle.height / 2,
          width: defaultCircle.width,
          height: defaultCircle.height,
        });
      }
    }
    onFinish();
  }

  function cancel() {
    if (!isDrawing) return;
    setIsDrawing(false);
    drawStartRef.current = null;
    setDraftShape(null);
    onFinish();
  }

  return {
    draftShape,
    isDrawing,
    start,
    move,
    finish,
    cancel,
  };
}
