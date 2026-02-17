"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { StickyNode } from "@/components/canvas/StickyNode";
import { RectNode } from "@/components/canvas/RectNode";
import { StickyTextEditOverlay } from "@/components/canvas/StickyTextEditOverlay";
import { ColorPickerOverlay } from "@/components/canvas/ColorPickerOverlay";
import { useViewport } from "@/components/canvas/hooks/useViewport";
import { useRectDraw } from "@/components/canvas/hooks/useRectDraw";
import { useRectTransformer } from "@/components/canvas/hooks/useRectTransformer";
import { useTrashImage } from "@/components/canvas/hooks/useTrashImage";
import { useStageMouseHandlers } from "@/components/canvas/hooks/useStageMouseHandlers";
import { useBoardObjectsSync } from "@/components/canvas/hooks/useBoardObjectsSync";
import { useBoardPresence } from "@/components/canvas/hooks/useBoardPresence";
import { CursorPresenceLayer } from "@/components/canvas/CursorPresenceLayer";
import {
  DEFAULT_STICKY,
  DEFAULT_RECT,
  DEFAULT_STICKY_COLOR,
  DEFAULT_RECT_COLOR,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  DRAFT_RECT_FILL,
  DRAFT_RECT_STROKE,
  DRAFT_RECT_DASH,
} from "@/components/canvas/constants";

type CanvasBoardProps = { boardId?: string | null };

export function CanvasBoard({ boardId = null }: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedRectRef = useRef<Konva.Rect | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [activeTool, setActiveTool] = useState<"select" | "sticky" | "rect">("select");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);
  const [colorPickerState, setColorPickerState] = useState<{
    id: string;
    anchor: { x: number; y: number };
  } | null>(null);

  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const storeAddObject = useBoardStore((state) => state.addObject);
  const storeUpdateObject = useBoardStore((state) => state.updateObject);
  const storeRemoveObject = useBoardStore((state) => state.removeObject);
  const setSelection = useBoardStore((state) => state.setSelection);

  const { trackCursor, cursorsRef } = useBoardPresence(boardId ?? null);
  const syncedActions = useBoardObjectsSync(boardId);
  const addObject = boardId ? syncedActions.addObject : storeAddObject;
  const updateObject = boardId ? syncedActions.updateObject : storeUpdateObject;
  const removeObject = boardId ? syncedActions.removeObject : storeRemoveObject;

  const trashImage = useTrashImage();
  const { viewport, handleWheel, getWorldPoint, startPan, panMove, endPan } =
    useViewport();

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const createSticky = useCallback(
    (position: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "sticky",
        x: position.x - DEFAULT_STICKY.width / 2,
        y: position.y - DEFAULT_STICKY.height / 2,
        width: DEFAULT_STICKY.width,
        height: DEFAULT_STICKY.height,
        rotation: 0,
        color: DEFAULT_STICKY_COLOR,
        text: "New note",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  const createRect = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "rect",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  useRectTransformer({
    selection,
    objects,
    selectedRectRef,
    transformerRef,
  });

  const handleObjectDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      updateObject(id, { x, y });
    },
    [updateObject]
  );

  const handleSelect = useCallback((id: string) => setSelection(id), [setSelection]);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const handleDelete = useCallback(
    (id: string) => {
      removeObject(id);
      setSelection(null);
    },
    [removeObject, setSelection]
  );

  function handleColorChange(id: string, color: string) {
    updateObject(id, { color });
  }

  function handleCustomColor(id: string, anchor: { x: number; y: number }) {
    setColorPickerState({ id, anchor });
  }

  const handleRectTransformEnd = useCallback(
    (id: string, width: number, height: number) => {
      updateObject(id, { width, height });
    },
    [updateObject]
  );

  const handleStartEdit = useCallback((id: string) => setEditingStickyId(id), []);

  const handleSaveStickyText = useCallback(
    (text: string) => {
      if (editingStickyId) {
        updateObject(editingStickyId, { text });
        setEditingStickyId(null);
      }
    },
    [editingStickyId, updateObject]
  );

  const handleCancelEdit = useCallback(() => setEditingStickyId(null), []);

  const rectDraw = useRectDraw({
    active: activeTool === "rect",
    defaultRect: DEFAULT_RECT,
    getWorldPoint,
    onCreateRect: createRect,
    onFinish: useCallback(() => setActiveTool("select"), [setActiveTool]),
    onClearSelection: useCallback(() => setSelection(null), [setSelection]),
  });

  const stageHandlers = useStageMouseHandlers({
    activeTool,
    getWorldPoint,
    startPan,
    panMove,
    endPan,
    rectDraw,
    createSticky,
    setActiveTool,
    setSelection,
  });

  const boundBoxFunc = useCallback(
    (
      oldBox: { x: number; y: number; width: number; height: number; rotation: number },
      newBox: { x: number; y: number; width: number; height: number; rotation: number }
    ) => {
      if (newBox.width < MIN_RECT_WIDTH || newBox.height < MIN_RECT_HEIGHT) {
        return oldBox;
      }
      return newBox;
    },
    []
  );

  const editingSticky =
    editingStickyId && objects[editingStickyId]?.type === "sticky"
      ? (objects[editingStickyId] as BoardObject & { type: "sticky" })
      : null;

  return (
    <div className="relative h-screen w-screen">
      <CanvasToolbar activeTool={activeTool} onSelectTool={setActiveTool} />

      <div className="relative">
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={false}
          onWheel={handleWheel}
          onMouseDown={stageHandlers.onMouseDown}
          onMouseMove={stageHandlers.onMouseMove}
          onMouseUp={stageHandlers.onMouseUp}
          onMouseLeave={stageHandlers.onMouseLeave}
        >
          <Layer
            onMouseMove={(e) => {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (stage && pointer && boardId) {
                trackCursor(getWorldPoint(stage, pointer));
              }
            }}
          >
            {rectDraw.draftRect && (
              <Rect
                x={rectDraw.draftRect.x}
                y={rectDraw.draftRect.y}
                width={rectDraw.draftRect.width}
                height={rectDraw.draftRect.height}
                fill={DRAFT_RECT_FILL}
                stroke={DRAFT_RECT_STROKE}
                dash={DRAFT_RECT_DASH}
              />
            )}
            {Object.values(objects).map((object) => {
              const isSelected = selection === object.id;
              const showControls = isSelected && hoveredId === object.id;

              if (object.type === "rect") {
                return (
                  <RectNode
                    key={object.id}
                    object={object as BoardObject & { type: "rect" }}
                    isSelected={isSelected}
                    showControls={showControls}
                    trashImage={trashImage}
                    selectedRectRef={selectedRectRef}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
                    onColorChange={handleColorChange}
                    onCustomColor={handleCustomColor}
                    onDragEnd={handleObjectDragEnd}
                    onTransformEnd={handleRectTransformEnd}
                  />
                );
              }

              return (
                <StickyNode
                  key={object.id}
                  object={object as BoardObject & { type: "sticky" }}
                  isSelected={isSelected}
                  showControls={showControls}
                  trashImage={trashImage}
                  onSelect={handleSelect}
                  onHover={handleHover}
                  onDelete={handleDelete}
                  onColorChange={handleColorChange}
                  onCustomColor={handleCustomColor}
                  onDragEnd={handleObjectDragEnd}
                  onStartEdit={handleStartEdit}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              boundBoxFunc={boundBoxFunc}
            />
          </Layer>
          <CursorPresenceLayer cursorsRef={cursorsRef} />
        </Stage>

        {editingSticky && (
          <StickyTextEditOverlay
            object={editingSticky}
            viewport={viewport}
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            onSave={handleSaveStickyText}
            onCancel={handleCancelEdit}
          />
        )}
        {colorPickerState && (
          <ColorPickerOverlay
            anchor={colorPickerState.anchor}
            viewport={viewport}
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            value={objects[colorPickerState.id]?.color ?? "#000000"}
            onChange={(color) => handleColorChange(colorPickerState.id, color)}
            onClose={() => setColorPickerState(null)}
          />
        )}
      </div>
    </div>
  );
}
