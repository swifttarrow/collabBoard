"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import { CanvasToolbar, type Tool } from "@/components/canvas/CanvasToolbar";
import { StickyNode } from "@/components/canvas/StickyNode";
import { RectNode } from "@/components/canvas/RectNode";
import { CircleNode } from "@/components/canvas/CircleNode";
import { LineNode } from "@/components/canvas/LineNode";
import { StickyTextEditOverlay } from "@/components/canvas/StickyTextEditOverlay";
import { ColorPickerOverlay } from "@/components/canvas/ColorPickerOverlay";
import { useViewport } from "@/components/canvas/hooks/useViewport";
import { useShapeDraw } from "@/components/canvas/hooks/useShapeDraw";
import { useShapeTransformer } from "@/components/canvas/hooks/useRectTransformer";
import { useTrashImage } from "@/components/canvas/hooks/useTrashImage";
import { useStageMouseHandlers } from "@/components/canvas/hooks/useStageMouseHandlers";
import { useBoardObjectsSync } from "@/components/canvas/hooks/useBoardObjectsSync";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { CursorPresenceLayer } from "@/components/canvas/CursorPresenceLayer";
import {
  DEFAULT_STICKY,
  DEFAULT_RECT,
  DEFAULT_CIRCLE,
  DEFAULT_LINE_LENGTH,
  DEFAULT_STICKY_COLOR,
  DEFAULT_RECT_COLOR,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  MIN_CIRCLE_SIZE,
  DRAFT_RECT_FILL,
  DRAFT_RECT_STROKE,
  DRAFT_RECT_DASH,
  DRAFT_CIRCLE_FILL,
  DRAFT_CIRCLE_STROKE,
  DRAFT_CIRCLE_DASH,
  DRAFT_LINE_STROKE,
  DRAFT_LINE_DASH,
} from "@/components/canvas/constants";

type CanvasBoardProps = { boardId: string };

export function CanvasBoard({ boardId }: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedRectRef = useRef<Konva.Rect | null>(null);
  const selectedCircleRef = useRef<Konva.Rect | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);
  const [colorPickerState, setColorPickerState] = useState<{
    id: string;
    anchor: { x: number; y: number };
  } | null>(null);

  const objects = useBoardStore((state) => state.objects);
  const selection = useBoardStore((state) => state.selection);
  const setSelection = useBoardStore((state) => state.setSelection);

  const { trackCursor, cursorsRef } = useBoardPresenceContext();
  const { addObject, updateObject, removeObject } = useBoardObjectsSync(boardId);

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

  const createCircle = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }) => {
      const id = crypto.randomUUID();
      const size = Math.max(MIN_CIRCLE_SIZE, Math.min(bounds.width, bounds.height));
      const object: BoardObject = {
        id,
        type: "circle",
        x: bounds.x,
        y: bounds.y,
        width: size,
        height: size,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  const createLine = useCallback(
    (bounds: { x1: number; y1: number; x2: number; y2: number }) => {
      const id = crypto.randomUUID();
      const object: BoardObject = {
        id,
        type: "line",
        x: bounds.x1,
        y: bounds.y1,
        width: 0,
        height: 0,
        rotation: 0,
        color: DEFAULT_RECT_COLOR,
        text: "",
        data: { x2: bounds.x2, y2: bounds.y2 },
      };
      addObject(object);
      setSelection(id);
    },
    [addObject, setSelection]
  );

  useShapeTransformer({
    selection,
    objects,
    selectedRectRef,
    selectedCircleRef,
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

  const handleCircleTransformEnd = useCallback(
    (id: string, width: number, height: number) => {
      const size = Math.max(MIN_CIRCLE_SIZE, Math.min(width, height));
      updateObject(id, { width: size, height: size });
    },
    [updateObject]
  );

  const handleLineAnchorMove = useCallback(
    (id: string, _anchor: "start" | "end", x2: number, y2: number) => {
      updateObject(id, { data: { x2, y2 } });
    },
    [updateObject]
  );

  const handleLineMove = useCallback(
    (id: string, x: number, y: number, x2: number, y2: number) => {
      updateObject(id, { x, y, data: { x2, y2 } });
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

  const shapeDraw = useShapeDraw({
    active: activeTool === "rect" || activeTool === "circle" || activeTool === "line",
    shapeTool: activeTool === "rect" || activeTool === "circle" || activeTool === "line" ? activeTool : "rect",
    defaultRect: DEFAULT_RECT,
    defaultCircle: DEFAULT_CIRCLE,
    defaultLineLength: DEFAULT_LINE_LENGTH,
    getWorldPoint,
    onCreateRect: createRect,
    onCreateCircle: createCircle,
    onCreateLine: createLine,
    onFinish: useCallback(() => setActiveTool("select"), [setActiveTool]),
    onClearSelection: useCallback(() => setSelection(null), [setSelection]),
  });

  const stageHandlers = useStageMouseHandlers({
    activeTool,
    getWorldPoint,
    startPan,
    panMove,
    endPan,
    shapeDraw,
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
          onMouseMove={(e) => {
            stageHandlers.onMouseMove(e);
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (stage && pointer) trackCursor(getWorldPoint(stage, pointer));
          }}
          onMouseUp={stageHandlers.onMouseUp}
          onMouseLeave={stageHandlers.onMouseLeave}
        >
          <Layer>
            {shapeDraw.draftShape?.type === "rect" && (
              <Rect
                x={shapeDraw.draftShape.bounds.x}
                y={shapeDraw.draftShape.bounds.y}
                width={shapeDraw.draftShape.bounds.width}
                height={shapeDraw.draftShape.bounds.height}
                fill={DRAFT_RECT_FILL}
                stroke={DRAFT_RECT_STROKE}
                dash={DRAFT_RECT_DASH}
              />
            )}
            {shapeDraw.draftShape?.type === "circle" && (() => {
              const b = shapeDraw.draftShape.bounds;
              const size = Math.max(Math.abs(b.width), Math.abs(b.height));
              const cx = b.x + b.width / 2;
              const cy = b.y + b.height / 2;
              return (
                <Rect
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  cornerRadius={size / 2}
                  fill={DRAFT_CIRCLE_FILL}
                  stroke={DRAFT_CIRCLE_STROKE}
                  dash={DRAFT_CIRCLE_DASH}
                />
              );
            })()}
            {shapeDraw.draftShape?.type === "line" && (
              <Line
                points={[
                  shapeDraw.draftShape.bounds.x1,
                  shapeDraw.draftShape.bounds.y1,
                  shapeDraw.draftShape.bounds.x2,
                  shapeDraw.draftShape.bounds.y2,
                ]}
                stroke={DRAFT_LINE_STROKE}
                strokeWidth={3}
                lineCap="round"
                dash={DRAFT_LINE_DASH}
              />
            )}
            {Object.values(objects)
              .filter((object) => object.id !== selection)
              .map((object) => {
                const isSelected = false;
                const showControls = false;

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
                if (object.type === "circle") {
                  return (
                    <CircleNode
                      key={object.id}
                      object={object as BoardObject & { type: "circle" }}
                      isSelected={isSelected}
                      showControls={showControls}
                      trashImage={trashImage}
                      selectedCircleRef={selectedCircleRef}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onDelete={handleDelete}
                      onColorChange={handleColorChange}
                      onCustomColor={handleCustomColor}
                      onDragEnd={handleObjectDragEnd}
                      onTransformEnd={handleCircleTransformEnd}
                    />
                  );
                }
                if (object.type === "line") {
                  return (
                    <LineNode
                      key={object.id}
                      object={object as BoardObject & { type: "line" }}
                      isSelected={isSelected}
                      showControls={showControls}
                      trashImage={trashImage}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onDelete={handleDelete}
                      onColorChange={handleColorChange}
                      onCustomColor={handleCustomColor}
                      onDragEnd={handleObjectDragEnd}
                      onAnchorMove={handleLineAnchorMove}
                      onLineMove={handleLineMove}
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
            {selection && objects[selection] && (() => {
              const object = objects[selection];
              const isSelected = true;
              const showControls = hoveredId === object.id;

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
              if (object.type === "circle") {
                return (
                  <CircleNode
                    key={object.id}
                    object={object as BoardObject & { type: "circle" }}
                    isSelected={isSelected}
                    showControls={showControls}
                    trashImage={trashImage}
                    selectedCircleRef={selectedCircleRef}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
                    onColorChange={handleColorChange}
                    onCustomColor={handleCustomColor}
                    onDragEnd={handleObjectDragEnd}
                    onTransformEnd={handleCircleTransformEnd}
                  />
                );
              }
              if (object.type === "line") {
                return (
                  <LineNode
                    key={object.id}
                    object={object as BoardObject & { type: "line" }}
                    isSelected={isSelected}
                    showControls={showControls}
                    trashImage={trashImage}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
                    onColorChange={handleColorChange}
                    onCustomColor={handleCustomColor}
                    onDragEnd={handleObjectDragEnd}
                    onAnchorMove={handleLineAnchorMove}
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
            })()}
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
