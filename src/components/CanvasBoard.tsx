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
import { useBoxSelect } from "@/components/canvas/hooks/useBoxSelect";
import { useKeyboardShortcuts } from "@/components/canvas/hooks/useKeyboardShortcuts";
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
  BOX_SELECT_FILL,
  BOX_SELECT_STROKE,
  BOX_SELECT_DASH,
  TRASH_CORNER_OFFSET,
} from "@/components/canvas/constants";

type CanvasBoardProps = { boardId: string };

export function CanvasBoard({ boardId }: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
  const dragGroupRef = useRef<{
    draggedId: string;
    startX: number;
    startY: number;
    others: Array<{
      id: string;
      startX: number;
      startY: number;
      startX2?: number;
      startY2?: number;
    }>;
  } | null>(null);

  const registerNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefsMap.current.set(id, node);
    } else {
      nodeRefsMap.current.delete(id);
    }
  }, []);

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
  const toggleSelection = useBoardStore((state) => state.toggleSelection);
  const clearSelection = useBoardStore((state) => state.clearSelection);

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
    nodeRefsMap,
    transformerRef,
  });

  useKeyboardShortcuts({
    selection,
    objects,
    addObject,
    removeObject,
    clearSelection,
    setSelection,
    isEditingSticky: !!editingStickyId,
  });

  const handleObjectDragStart = useCallback(
    (id: string) => {
      if (!selection.includes(id) || selection.length <= 1) return;
      const obj = objects[id];
      if (!obj) return;
      const others = selection
        .filter((oid) => oid !== id)
        .map((oid) => {
          const o = objects[oid];
          if (!o) return null;
          if (o.type === "line") {
            const x2 = (o.data as { x2?: number; y2?: number })?.x2 ?? o.x;
            const y2 = (o.data as { x2?: number; y2?: number })?.y2 ?? o.y;
            return { id: oid, startX: o.x, startY: o.y, startX2: x2, startY2: y2 };
          }
          return { id: oid, startX: o.x, startY: o.y };
        })
        .filter((o): o is NonNullable<typeof o> => o != null);
      dragGroupRef.current = { draggedId: id, startX: obj.x, startY: obj.y, others };
    },
    [objects, selection]
  );

  const handleObjectDragMove = useCallback(
    (id: string, x: number, y: number, lineEnd?: { x2: number; y2: number }) => {
      const state = dragGroupRef.current;
      if (!state || state.draggedId !== id) return;
      const dx = x - state.startX;
      const dy = y - state.startY;

      if (lineEnd) {
        updateObject(id, { x, y, data: { x2: lineEnd.x2, y2: lineEnd.y2 } });
      } else {
        updateObject(id, { x, y });
      }

      for (const other of state.others) {
        if (other.startX2 !== undefined && other.startY2 !== undefined) {
          updateObject(other.id, {
            x: other.startX + dx,
            y: other.startY + dy,
            data: { x2: other.startX2 + dx, y2: other.startY2 + dy },
          });
        } else {
          updateObject(other.id, { x: other.startX + dx, y: other.startY + dy });
        }
      }
    },
    [updateObject]
  );

  const handleObjectDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const state = dragGroupRef.current;
      dragGroupRef.current = null;

      const obj = objects[id];
      if (!obj) return;
      const startX = state?.draggedId === id ? state.startX : obj.x;
      const startY = state?.draggedId === id ? state.startY : obj.y;
      const dx = x - startX;
      const dy = y - startY;

      updateObject(id, { x, y });
      if (selection.includes(id) && selection.length > 1) {
        const othersToUpdate =
          state?.draggedId === id
            ? state.others
            : selection
                .filter((oid) => oid !== id)
                .map((oid) => {
                  const o = objects[oid];
                  if (!o) return null;
                  if (o.type === "line") {
                    const x2 = (o.data as { x2?: number; y2?: number })?.x2 ?? o.x;
                    const y2 = (o.data as { x2?: number; y2?: number })?.y2 ?? o.y;
                    return { id: oid, startX: o.x, startY: o.y, startX2: x2, startY2: y2 };
                  }
                  return { id: oid, startX: o.x, startY: o.y };
                })
                .filter((o): o is NonNullable<typeof o> => o != null);

        for (const other of othersToUpdate) {
          if (other.startX2 !== undefined && other.startY2 !== undefined) {
            updateObject(other.id, {
              x: other.startX + dx,
              y: other.startY + dy,
              data: { x2: other.startX2 + dx, y2: other.startY2 + dy },
            });
          } else {
            updateObject(other.id, { x: other.startX + dx, y: other.startY + dy });
          }
        }
      }
    },
    [updateObject, objects, selection]
  );

  const handleSelect = useCallback(
    (id: string, shiftKey?: boolean) => {
      if (shiftKey) {
        toggleSelection(id);
      } else {
        setSelection(id);
      }
    },
    [setSelection, toggleSelection]
  );

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const handleDelete = useCallback(
    (id: string) => {
      removeObject(id);
      clearSelection();
    },
    [removeObject, clearSelection]
  );

  function handleColorChange(id: string, color: string) {
    updateObject(id, { color });
  }

  function handleCustomColor(id: string, anchor: { x: number; y: number }) {
    setColorPickerState({ id, anchor });
  }

  const handleTransformerTransformEnd = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = transformer.getNodes();
    for (const node of nodes) {
      const id = node.name();
      const obj = objects[id];
      if (!obj) continue;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      // Node is inner Group at (0,0) relative to parent; parent is at (obj.x, obj.y)
      const offsetX = node.x();
      const offsetY = node.y();
      node.x(0);
      node.y(0);
      const newX = obj.x + offsetX;
      const newY = obj.y + offsetY;

      if (obj.type === "line") {
        const x2 = (obj.data as { x2?: number; y2?: number })?.x2 ?? obj.x;
        const y2 = (obj.data as { x2?: number; y2?: number })?.y2 ?? obj.y;
        if (selection.length > 1) {
          // Lines in a group: only translate, never scale (scaling would distort the line)
          updateObject(id, {
            x: newX,
            y: newY,
            data: { x2: x2 + offsetX, y2: y2 + offsetY },
          });
        } else {
          // Single line: allow resize via Transformer
          const line = (node as Konva.Container).findOne("Line") as Konva.Line | undefined;
          if (line) {
            const pts = line.points();
            const localX2 = pts.length >= 4 ? pts[2] : x2 - obj.x;
            const localY2 = pts.length >= 4 ? pts[3] : y2 - obj.y;
            const newX2 = newX + localX2 * scaleX;
            const newY2 = newY + localY2 * scaleY;
            updateObject(id, { x: newX, y: newY, data: { x2: newX2, y2: newY2 } });
          }
        }
      } else {
        const shape = (node as Konva.Container).findOne("Rect");
        if (shape) {
          const w = shape.width() * scaleX;
          const h = shape.height() * scaleY;
          if (obj.type === "circle") {
            const size = Math.max(MIN_CIRCLE_SIZE, Math.min(w, h));
            updateObject(id, { x: newX, y: newY, width: size, height: size });
          } else {
            updateObject(id, {
              x: newX,
              y: newY,
              width: Math.max(MIN_RECT_WIDTH, w),
              height: Math.max(MIN_RECT_HEIGHT, h),
            });
          }
        }
      }
    }
  }, [updateObject, objects, selection, transformerRef]);

  const handleLineAnchorMove = useCallback(
    (id: string, anchor: "start" | "end", x: number, y: number) => {
      if (anchor === "start") {
        updateObject(id, { x, y });
      } else {
        updateObject(id, { data: { x2: x, y2: y } });
      }
    },
    [updateObject]
  );

  const handleLineMove = useCallback(
    (id: string, x: number, y: number, x2: number, y2: number) => {
      const obj = objects[id];
      if (!obj) return;
      const dx = x - obj.x;
      const dy = y - obj.y;
      updateObject(id, { x, y, data: { x2, y2 } });
      if (selection.includes(id) && selection.length > 1) {
        for (const otherId of selection) {
          if (otherId === id) continue;
          const other = objects[otherId];
          if (!other) continue;
          if (other.type === "line") {
            const ox2 = (other.data as { x2?: number; y2?: number })?.x2 ?? other.x;
            const oy2 = (other.data as { x2?: number; y2?: number })?.y2 ?? other.y;
            updateObject(otherId, {
              x: other.x + dx,
              y: other.y + dy,
              data: { x2: ox2 + dx, y2: oy2 + dy },
            });
          } else {
            updateObject(otherId, { x: other.x + dx, y: other.y + dy });
          }
        }
      }
    },
    [updateObject, objects, selection]
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

  const boxSelect = useBoxSelect({
    getWorldPoint,
    objects,
    setSelection,
    selection,
  });

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
    onClearSelection: useCallback(() => clearSelection(), [clearSelection]),
  });

  const stageHandlers = useStageMouseHandlers({
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
            {boxSelect.draftBox && (
              <Rect
                x={boxSelect.draftBox.x}
                y={boxSelect.draftBox.y}
                width={boxSelect.draftBox.width}
                height={boxSelect.draftBox.height}
                fill={BOX_SELECT_FILL}
                stroke={BOX_SELECT_STROKE}
                dash={BOX_SELECT_DASH}
                listening={false}
              />
            )}
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
              .filter((object) => !selection.includes(object.id))
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
                      registerNodeRef={registerNodeRef}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onDelete={handleDelete}
                      onColorChange={handleColorChange}
                      onCustomColor={handleCustomColor}
                      onDragStart={handleObjectDragStart}
                      onDragMove={handleObjectDragMove}
                      onDragEnd={handleObjectDragEnd}
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
                      registerNodeRef={registerNodeRef}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onDelete={handleDelete}
                      onColorChange={handleColorChange}
                      onCustomColor={handleCustomColor}
                      onDragStart={handleObjectDragStart}
                      onDragMove={handleObjectDragMove}
                      onDragEnd={handleObjectDragEnd}
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
                      onDragStart={handleObjectDragStart}
                      onDragMove={(id, x, y, lineEnd) => handleObjectDragMove(id, x, y, lineEnd)}
                      onDragEnd={handleObjectDragEnd}
                      onAnchorMove={handleLineAnchorMove}
                      onLineMove={handleLineMove}
                      registerNodeRef={registerNodeRef}
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
                    onDragStart={handleObjectDragStart}
                    onDragMove={handleObjectDragMove}
                    onDragEnd={handleObjectDragEnd}
                    onStartEdit={handleStartEdit}
                    registerNodeRef={registerNodeRef}
                  />
                );
              })}
            {selection.length > 0 &&
              selection.map((id) => {
                const object = objects[id];
                if (!object) return null;
                const isSelected = true;
                const showControls = selection.length === 1 && hoveredId === object.id;

                if (object.type === "rect") {
                  return (
                    <RectNode
                      key={object.id}
                      object={object as BoardObject & { type: "rect" }}
                      isSelected={isSelected}
                      showControls={showControls}
                      trashImage={trashImage}
                      registerNodeRef={registerNodeRef}
                      onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
                    onColorChange={handleColorChange}
                    onCustomColor={handleCustomColor}
                    onDragStart={handleObjectDragStart}
                    onDragMove={handleObjectDragMove}
                    onDragEnd={handleObjectDragEnd}
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
                      registerNodeRef={registerNodeRef}
                      onSelect={handleSelect}
                    onHover={handleHover}
                    onDelete={handleDelete}
                    onColorChange={handleColorChange}
                    onCustomColor={handleCustomColor}
                    onDragStart={handleObjectDragStart}
                    onDragMove={handleObjectDragMove}
                    onDragEnd={handleObjectDragEnd}
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
                    onDragStart={handleObjectDragStart}
                    onDragMove={(id, x, y, lineEnd) => handleObjectDragMove(id, x, y, lineEnd)}
                    onDragEnd={handleObjectDragEnd}
                    onAnchorMove={handleLineAnchorMove}
                    onLineMove={handleLineMove}
                    registerNodeRef={registerNodeRef}
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
                  onDragStart={handleObjectDragStart}
                  onDragMove={handleObjectDragMove}
                  onDragEnd={handleObjectDragEnd}
                  onStartEdit={handleStartEdit}
                  registerNodeRef={registerNodeRef}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              padding={TRASH_CORNER_OFFSET}
              boundBoxFunc={boundBoxFunc}
              onTransformEnd={handleTransformerTransformEnd}
              borderStroke={BOX_SELECT_STROKE}
              borderStrokeWidth={2}
              anchorStroke={BOX_SELECT_STROKE}
              anchorFill="white"
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
