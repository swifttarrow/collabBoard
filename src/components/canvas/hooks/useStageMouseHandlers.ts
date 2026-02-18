import { useCallback } from "react";
import type Konva from "konva";
import type { Tool } from "@/components/canvas/CanvasToolbar";

type Point = { x: number; y: number };

type ShapeDrawAPI = {
  start: (stage: Konva.Stage) => void;
  move: (stage: Konva.Stage) => void;
  finish: () => void;
  cancel: () => void;
  isDrawing: boolean;
};

type BoxSelectAPI = {
  start: (stage: Konva.Stage, shiftKey: boolean) => void;
  move: (stage: Konva.Stage) => void;
  finish: () => void;
  cancel: () => void;
  isSelecting: boolean;
};

type UseStageMouseHandlersParams = {
  activeTool: Tool;
  getWorldPoint: (stage: Konva.Stage, pointer: Point) => Point;
  startPan: (pointer: Point) => void;
  panMove: (pointer: Point) => void;
  endPan: () => void;
  shapeDraw: ShapeDrawAPI;
  boxSelect: BoxSelectAPI;
  createSticky: (position: Point) => void;
  setActiveTool: (tool: Tool) => void;
  clearSelection: () => void;
};

const SHAPE_TOOLS = ["rect", "circle", "line"] as const;

export function useStageMouseHandlers({
  activeTool,
  getWorldPoint,
  startPan,
  panMove,
  endPan,
  shapeDraw,
  boxSelect,
  createSticky,
  setActiveTool,
  clearSelection,
}: UseStageMouseHandlersParams) {
  const onMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage();
      const isStage = event.target === stage;
      if (!stage) return;

      if (isStage && activeTool === "sticky") {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPoint = getWorldPoint(stage, pointer);
        createSticky(worldPoint);
        setActiveTool("select");
        return;
      }

      if (isStage && SHAPE_TOOLS.includes(activeTool as (typeof SHAPE_TOOLS)[number])) {
        shapeDraw.start(stage);
        return;
      }

      if (isStage && activeTool === "select" && event.evt.shiftKey) {
        boxSelect.start(stage, true);
        return;
      }

      if (isStage) {
        clearSelection();
        const pointer = stage.getPointerPosition();
        if (pointer) {
          startPan(pointer);
        }
      }
    },
    [
      activeTool,
      getWorldPoint,
      createSticky,
      setActiveTool,
      clearSelection,
      startPan,
      shapeDraw,
      boxSelect,
    ]
  );

  const onMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return;
      if (shapeDraw.isDrawing) {
        shapeDraw.move(stage);
        return;
      }
      if (boxSelect.isSelecting) {
        boxSelect.move(stage);
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      panMove(pointer);
    },
    [shapeDraw, boxSelect, panMove]
  );

  const onMouseUp = useCallback(() => {
    if (shapeDraw.isDrawing) {
      shapeDraw.finish();
    }
    if (boxSelect.isSelecting) {
      boxSelect.finish();
    }
    endPan();
  }, [shapeDraw, boxSelect, endPan]);

  const onMouseLeave = useCallback(() => {
    endPan();
    if (shapeDraw.isDrawing) {
      shapeDraw.cancel();
    }
    if (boxSelect.isSelecting) {
      boxSelect.cancel();
    }
  }, [endPan, shapeDraw, boxSelect]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
}
