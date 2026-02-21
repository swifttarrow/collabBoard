"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { Group, Arrow, Circle, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import type { LineData, LineCap } from "@/lib/line/types";
import type { RoutingMode } from "@/lib/line/connector-types";
import {
  getLineGeometry,
  geometryToLinePoints,
  geometryToKonvaPoints,
} from "@/lib/line/geometry";
import { ColorPalette, PALETTE_WIDTH, PALETTE_HEIGHT } from "./ColorPalette";
import { TrashButton } from "./TrashButton";
import { DuplicateButton } from "./DuplicateButton";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_SIZE,
  TRASH_CORNER_OFFSET,
  PALETTE_FLOATING_GAP,
  SELECTION_STROKE_WIDTH,
  DEFAULT_RECT_COLOR,
  BUTTON_GAP,
} from "./constants";

const DEFAULT_STROKE_WIDTH = 2;
const LINE_HIT_PADDING = 12;
const ANCHOR_RADIUS = 2;
const ARROW_LENGTH = 10;
const ARROW_WIDTH = 8;
const POINT_RADIUS = 4;

type LineObject = BoardObject & { type: "line"; data?: LineData };

function getLineData(obj: LineObject): LineData {
  const d = obj.data;
  if (!d || typeof d !== "object") {
    return { x2: obj.x + 80, y2: obj.y } as LineData;
  }
  return d as LineData;
}

type LineNodeProps = {
  object: LineObject;
  objects: Record<string, BoardObject>;
  isSelected: boolean;
  showControls: boolean;
  isHighlighted?: boolean;
  draggable?: boolean;
  trashImage: HTMLImageElement | null;
  copyImage: HTMLImageElement | null;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number, lineEnd?: { x2: number; y2: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onAnchorMove: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onAnchorDrop?: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onLineMove?: (id: string, x: number, y: number, x2: number, y2: number) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function LineNode({
  object,
  objects,
  isSelected,
  showControls,
  isHighlighted = false,
  draggable: draggableProp,
  trashImage,
  copyImage,
  onSelect,
  onHover,
  onDelete,
  onDuplicate,
  onColorChange,
  onCustomColor,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAnchorMove,
  onAnchorDrop,
  onLineMove,
  registerNodeRef,
}: LineNodeProps) {
  const data = getLineData(object);
  const geom = getLineGeometry(object, objects);
  const { startX, startY, endX, endY } = geom;
  const routingMode = (data.routingMode ?? "orthogonal") as RoutingMode;
  const points =
    routingMode === "curved"
      ? geometryToKonvaPoints(geom, routingMode)
      : geometryToLinePoints(geom);
  const strokeWidth = data.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const startCap = (data.startCap ?? "point") as LineCap;
  const endCap = (data.endCap ?? "arrow") as LineCap;
  const hasStartAttachment =
    (data.start?.type === "attached" && !!objects[data.start.nodeId]) ||
    (!!data.startShapeId && !!objects[data.startShapeId]);
  const hasEndAttachment =
    (data.end?.type === "attached" && !!objects[data.end.nodeId]) ||
    (!!data.endShapeId && !!objects[data.endShapeId]);

  const prevPosRef = useRef({ x: startX, y: startY });
  const initialLineEndRef = useRef({ x2: endX, y2: endY });

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; // Select deepest node; prevent frame from overwriting when object is inside frame
      onSelect(object.id, e.evt.shiftKey);
    },
    [object.id, onSelect]
  );
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  const handleGroupDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      prevPosRef.current = { x: startX, y: startY };
      initialLineEndRef.current = { x2: endX, y2: endY };
      onDragStart?.(object.id);
    },
    [object.id, startX, startY, endX, endY, onDragStart]
  );

  const handleGroupDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      const target = e.target;
      const newX = target.x();
      const newY = target.y();
      const dx = newX - prevPosRef.current.x;
      const dy = newY - prevPosRef.current.y;
      const { x2: startX2, y2: startY2 } = initialLineEndRef.current;
      if (onDragMove) {
        onDragMove(object.id, newX, newY, {
          x2: startX2 + dx,
          y2: startY2 + dy,
        });
      }
    },
    [object.id, onDragMove]
  );

  const handleGroupDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd (would overwrite frame position)
      const target = e.target;
      const newX = target.x();
      const newY = target.y();
      const dx = newX - prevPosRef.current.x;
      const dy = newY - prevPosRef.current.y;
      prevPosRef.current = { x: newX, y: newY };
      const { x2: startX2, y2: startY2 } = initialLineEndRef.current;
      const newX2 = startX2 + dx;
      const newY2 = startY2 + dy;
      if (onLineMove) {
        onLineMove(object.id, newX, newY, newX2, newY2);
      } else {
        onDragEnd(object.id, newX, newY);
        onAnchorMove(object.id, "end", newX2, newY2);
      }
    },
    [object.id, onDragEnd, onAnchorMove, onLineMove]
  );

  const stopAnchorBubble = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
  }, []);

  const handleAnchor1DragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX = startX + target.x();
      const newY = startY + target.y();
      onAnchorMove(object.id, "start", newX, newY);
    },
    [object.id, startX, startY, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor1DragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX = startX + target.x();
      const newY = startY + target.y();
      if (onAnchorDrop) {
        onAnchorDrop(object.id, "start", newX, newY);
      } else {
        onAnchorMove(object.id, "start", newX, newY);
      }
    },
    [object.id, startX, startY, onAnchorMove, onAnchorDrop, stopAnchorBubble]
  );

  const handleAnchor2DragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX2 = startX + target.x();
      const newY2 = startY + target.y();
      onAnchorMove(object.id, "end", newX2, newY2);
    },
    [object.id, startX, startY, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor2DragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX2 = startX + target.x();
      const newY2 = startY + target.y();
      if (onAnchorDrop) {
        onAnchorDrop(object.id, "end", newX2, newY2);
      } else {
        onAnchorMove(object.id, "end", newX2, newY2);
      }
    },
    [object.id, startX, startY, onAnchorMove, onAnchorDrop, stopAnchorBubble]
  );

  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleDuplicate = useCallback(() => onDuplicate(object.id), [object.id, onDuplicate]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );
  const handleCustomColor = useCallback(() => {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    onCustomColor(object.id, {
      x: midX + PALETTE_WIDTH - 28,
      y: midY + PALETTE_FLOATING_GAP + 14,
    });
  }, [object.id, startX, startY, endX, endY, onCustomColor]);

  const color = object.color || DEFAULT_RECT_COLOR;
  const lineLength = Math.hypot(endX - startX, endY - startY);
  const paletteX = Math.max(0, lineLength / 2 - PALETTE_WIDTH / 2);
  const paletteY = 24;

  const minX = Math.min(0, ...points.filter((_, i) => i % 2 === 0)) - TRASH_CORNER_OFFSET - TRASH_SIZE;
  const minY = Math.min(0, ...points.filter((_, i) => i % 2 === 1)) - TRASH_CORNER_OFFSET - TRASH_SIZE;
  const maxX =
    Math.max(0, ...points.filter((_, i) => i % 2 === 0)) +
    TRASH_CORNER_OFFSET +
    Math.max(PALETTE_WIDTH, TRASH_SIZE);
  const maxY = Math.max(
    paletteY + PALETTE_HEIGHT,
    ...points.filter((_, i) => i % 2 === 1)
  ) + PALETTE_FLOATING_GAP;

  const canDragByAttachment = !hasStartAttachment && !hasEndAttachment;
  const isDraggable = draggableProp !== false && canDragByAttachment;

  return (
    <Group
      key={object.id}
      name={object.id}
      x={startX}
      y={startY}
      draggable={isDraggable}
      onDragStart={handleGroupDragStart}
      onDragMove={handleGroupDragMove}
      onDragEnd={handleGroupDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isSelected && (
        <Rect
          x={minX}
          y={minY}
          width={maxX - minX}
          height={maxY - minY}
          fill="transparent"
          listening
        />
      )}
      <Group ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)} name={object.id}>
        <Arrow
          points={points}
          stroke={color}
          fill={color}
          strokeWidth={strokeWidth + (isHighlighted ? 2 : 0)}
          hitStrokeWidth={Math.max(strokeWidth, 8) + LINE_HIT_PADDING * 2}
          lineCap="round"
          lineJoin="round"
          pointerAtBeginning={startCap === "arrow"}
          pointerAtEnding={endCap === "arrow"}
          pointerLength={ARROW_LENGTH}
          pointerWidth={ARROW_WIDTH}
          listening
        />
        {startCap === "point" && (
          <Circle
            x={0}
            y={0}
            radius={POINT_RADIUS}
            fill={color}
            stroke={color}
            listening={false}
          />
        )}
        {endCap === "point" && points.length >= 2 && (
          <Circle
            x={points[points.length - 2] ?? 0}
            y={points[points.length - 1] ?? 0}
            radius={POINT_RADIUS}
            fill={color}
            stroke={color}
            listening={false}
          />
        )}
        {isSelected && !hasStartAttachment && (
          <Circle
            x={0}
            y={0}
            radius={ANCHOR_RADIUS}
            fill="white"
            stroke={getSelectionStroke(color)}
            strokeWidth={SELECTION_STROKE_WIDTH}
            draggable
            onDragStart={stopAnchorBubble}
            onDragMove={handleAnchor1DragMove}
            onDragEnd={handleAnchor1DragEnd}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "grab";
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "";
            }}
          />
        )}
        {isSelected && !hasEndAttachment && (
          <Circle
            x={points[points.length - 2] ?? 0}
            y={points[points.length - 1] ?? 0}
            radius={ANCHOR_RADIUS}
            fill="white"
            stroke={getSelectionStroke(color)}
            strokeWidth={SELECTION_STROKE_WIDTH}
            draggable
            onDragStart={stopAnchorBubble}
            onDragMove={handleAnchor2DragMove}
            onDragEnd={handleAnchor2DragEnd}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "grab";
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "";
            }}
          />
        )}
      </Group>
      {showControls && (
        <>
          <Group x={paletteX} y={paletteY} listening>
            <ColorPalette
              x={0}
              y={0}
              currentColor={color}
              onSelectColor={handleColorChange}
              onCustomColor={handleCustomColor}
            />
          </Group>
          <DuplicateButton
            x={Math.max(0, points[points.length - 2] ?? 0) + TRASH_CORNER_OFFSET - 2 * TRASH_SIZE - BUTTON_GAP}
            y={Math.min(0, points[points.length - 1] ?? 0) - TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={copyImage}
            onDuplicate={handleDuplicate}
          />
          <TrashButton
            x={Math.max(0, points[points.length - 2] ?? 0) + TRASH_CORNER_OFFSET - TRASH_SIZE}
            y={Math.min(0, points[points.length - 1] ?? 0) - TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={trashImage}
            onDelete={handleDelete}
          />
        </>
      )}
    </Group>
  );
}
