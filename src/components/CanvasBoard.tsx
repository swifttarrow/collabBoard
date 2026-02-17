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
import { useViewport } from "@/components/canvas/hooks/useViewport";
import { useRectDraw } from "@/components/canvas/hooks/useRectDraw";
import { useRectTransformer } from "@/components/canvas/hooks/useRectTransformer";
import { useTrashImage } from "@/components/canvas/hooks/useTrashImage";
import { useStageMouseHandlers } from "@/components/canvas/hooks/useStageMouseHandlers";
import {
  DEFAULT_STICKY,
  DEFAULT_RECT,
  COLORS,
  MIN_RECT_SIZE,
  DRAFT_RECT_FILL,
  DRAFT_RECT_STROKE,
  DRAFT_RECT_DASH,
} from "@/components/canvas/constants";

export function CanvasBoard() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedRectRef = useRef<Konva.Rect | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [activeTool, setActiveTool] = useState<"select" | "sticky" | "rect">("select");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);

  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const addObject = useBoardStore((state) => state.addObject);
  const updateObject = useBoardStore((state) => state.updateObject);
  const removeObject = useBoardStore((state) => state.removeObject);
  const setSelection = useBoardStore((state) => state.setSelection);

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
        color: COLORS[0],
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
        color: COLORS[2],
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
      if (newBox.width < MIN_RECT_SIZE || newBox.height < MIN_RECT_SIZE) {
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
          <Layer>
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
              const showTrash = isSelected && hoveredId === object.id;

              if (object.type === "rect") {
                return (
                  <RectNode
                    key={object.id}
                    object={object as BoardObject & { type: "rect" }}
                    isSelected={isSelected}
                    showTrash={showTrash}
                    trashImage={trashImage}
                    selectedRectRef={selectedRectRef}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
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
                  showTrash={showTrash}
                  trashImage={trashImage}
                  onSelect={handleSelect}
                  onHover={handleHover}
                  onDelete={handleDelete}
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
      </div>
    </div>
  );
}
