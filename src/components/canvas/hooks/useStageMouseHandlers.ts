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

type UseStageMouseHandlersParams = {
  activeTool: Tool;
  getWorldPoint: (stage: Konva.Stage, pointer: Point) => Point;
  startPan: (pointer: Point) => void;
  panMove: (pointer: Point) => void;
  endPan: () => void;
  shapeDraw: ShapeDrawAPI;
  createSticky: (position: Point) => void;
  setActiveTool: (tool: Tool) => void;
  setSelection: (id: string | null) => void;
};

const SHAPE_TOOLS = ["rect", "circle", "line"] as const;

export function useStageMouseHandlers({
  activeTool,
  getWorldPoint,
  startPan,
  panMove,
  endPan,
  shapeDraw,
  createSticky,
  setActiveTool,
  setSelection,
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

      if (isStage) {
        setSelection(null);
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
      setSelection,
      startPan,
      shapeDraw,
    ]
  );

  const onMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (shapeDraw.isDrawing) {
        shapeDraw.move(event.target.getStage() as Konva.Stage);
        return;
      }
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      panMove(pointer);
    },
    [shapeDraw, panMove]
  );

  const onMouseUp = useCallback(() => {
    if (shapeDraw.isDrawing) {
      shapeDraw.finish();
    }
    endPan();
  }, [shapeDraw, endPan]);

  const onMouseLeave = useCallback(() => {
    endPan();
    if (shapeDraw.isDrawing) {
      shapeDraw.cancel();
    }
  }, [endPan, shapeDraw]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
}
