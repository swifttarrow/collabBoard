import { useCallback } from "react";
import type Konva from "konva";

type Point = { x: number; y: number };

type RectDrawAPI = {
  start: (stage: Konva.Stage) => void;
  move: (stage: Konva.Stage) => void;
  finish: () => void;
  cancel: () => void;
  isDrawing: boolean;
};

type UseStageMouseHandlersParams = {
  activeTool: "select" | "sticky" | "rect";
  getWorldPoint: (stage: Konva.Stage, pointer: Point) => Point;
  startPan: (pointer: Point) => void;
  panMove: (pointer: Point) => void;
  endPan: () => void;
  rectDraw: RectDrawAPI;
  createSticky: (position: Point) => void;
  setActiveTool: (tool: "select" | "sticky" | "rect") => void;
  setSelection: (id: string | null) => void;
};

export function useStageMouseHandlers({
  activeTool,
  getWorldPoint,
  startPan,
  panMove,
  endPan,
  rectDraw,
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

      if (isStage && activeTool === "rect") {
        rectDraw.start(stage);
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
      rectDraw,
    ]
  );

  const onMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (rectDraw.isDrawing) {
        rectDraw.move(event.target.getStage() as Konva.Stage);
        return;
      }
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      panMove(pointer);
    },
    [rectDraw, panMove]
  );

  const onMouseUp = useCallback(() => {
    if (rectDraw.isDrawing) {
      rectDraw.finish();
    }
    endPan();
  }, [rectDraw, endPan]);

  const onMouseLeave = useCallback(() => {
    endPan();
    if (rectDraw.isDrawing) {
      rectDraw.cancel();
    }
  }, [endPan, rectDraw]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
}
