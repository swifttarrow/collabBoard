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

type LineCreationAPI = {
  isCreating: boolean;
  startFromPoint?: (stage: Konva.Stage) => void;
  move: (stage: Konva.Stage) => void;
  finish: () => void;
  cancel: () => void;
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
  createText: (position: Point) => void;
  createSticker?: (position: Point, slug: string) => void;
  pendingStickerSlug?: string | null;
  setPendingStickerSlug?: (slug: string | null) => void;
  setActiveTool: (tool: Tool) => void;
  clearSelection: () => void;
  lineCreation?: LineCreationAPI;
};

const SHAPE_TOOLS = ["rect", "circle", "frame", "line"] as const;

export function useStageMouseHandlers({
  activeTool,
  getWorldPoint,
  startPan,
  panMove,
  endPan,
  shapeDraw,
  boxSelect,
  createSticky,
  createText,
  createSticker,
  pendingStickerSlug,
  setPendingStickerSlug,
  setActiveTool,
  clearSelection,
  lineCreation,
}: UseStageMouseHandlersParams) {
  const onMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage();
      const isStage = event.target === stage;
      if (!stage) return;

      if (pendingStickerSlug && createSticker) {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPoint = getWorldPoint(stage, pointer);
        createSticker(worldPoint, pendingStickerSlug);
        setPendingStickerSlug?.(null);
        setActiveTool("select");
        return;
      }

      if (activeTool === "sticky") {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPoint = getWorldPoint(stage, pointer);
        createSticky(worldPoint);
        setActiveTool("select");
        return;
      }

      if (activeTool === "text") {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPoint = getWorldPoint(stage, pointer);
        createText(worldPoint);
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
        if (activeTool === "connector" && lineCreation?.startFromPoint) {
          // Start connector from empty space (free start); don't clear selection
          lineCreation.startFromPoint(stage);
          return;
        }
        clearSelection();
        // Don't start pan when connector is active - prevents accidental viewport movement
        if (activeTool !== "connector") {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            startPan(pointer);
          }
        }
      }
    },
    [
      activeTool,
      pendingStickerSlug,
      getWorldPoint,
      createSticky,
      createText,
      createSticker,
      setPendingStickerSlug,
      setActiveTool,
      clearSelection,
      startPan,
      shapeDraw,
      boxSelect,
      lineCreation,
    ]
  );

  const onMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return;
      if (lineCreation?.isCreating) {
        lineCreation.move(stage);
        return;
      }
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
    [shapeDraw, boxSelect, panMove, lineCreation]
  );

  const onMouseUp = useCallback(() => {
    if (lineCreation?.isCreating) {
      lineCreation.finish();
    }
    if (shapeDraw.isDrawing) {
      shapeDraw.finish();
    }
    if (boxSelect.isSelecting) {
      boxSelect.finish();
    }
    endPan();
  }, [shapeDraw, boxSelect, endPan, lineCreation]);

  const onMouseLeave = useCallback(() => {
    endPan();
    if (lineCreation?.isCreating) {
      lineCreation.cancel();
    }
    if (shapeDraw.isDrawing) {
      shapeDraw.cancel();
    }
    if (boxSelect.isSelecting) {
      boxSelect.cancel();
    }
  }, [endPan, shapeDraw, boxSelect, lineCreation]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
}
