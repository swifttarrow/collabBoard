"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { Group, Arrow, Circle, Rect, Line } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import type { LineData, LineCap } from "@/lib/line/types";
import type { RoutingMode } from "@/lib/line/connector-types";
import {
  getLineGeometry,
  geometryToLinePoints,
  geometryToKonvaPoints,
} from "@/lib/line/geometry";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_CORNER_OFFSET,
  SELECTION_STROKE_WIDTH,
  DEFAULT_RECT_COLOR,
  CONNECTOR_LINE_DASH,
} from "./constants";

const DEFAULT_STROKE_WIDTH = 2;
const LINE_HIT_PADDING = 12;
const ANCHOR_RADIUS = 6;
const ANCHOR_HIT_RADIUS = 10;
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
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onColorChange: (id: string, color: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number, lineEnd?: { x2: number; y2: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onAnchorMove: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onAnchorDrop?: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onAnchorDragStart?: () => void;
  onAnchorDragEnd?: () => void;
  onLineMove?: (id: string, x: number, y: number, x2: number, y2: number) => void;
  onStrokeStyleToggle?: (id: string) => void;
  onContextMenu: (
    id: string,
    objectType: "line",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onEndpointContextMenu?: (
    id: string,
    anchor: "start" | "end",
    position: { x: number; y: number }
  ) => void;
  isHovered?: boolean;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function LineNode({
  object,
  objects,
  isSelected,
  showControls,
  isHighlighted = false,
  draggable: draggableProp,
  onSelect,
  onHover,
  onColorChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAnchorMove,
  onAnchorDrop,
  onAnchorDragStart,
  onAnchorDragEnd,
  onLineMove,
  onStrokeStyleToggle,
  onContextMenu,
  onEndpointContextMenu,
  isHovered = false,
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
  const strokeStyle = data.strokeStyle ?? "solid";
  const isDashed = strokeStyle === "dashed";
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

  const showAnchors = isSelected || isHovered;

  const stopAnchorBubble = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
  }, []);

  const handleAnchorDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      onAnchorDragStart?.();
      if (!isSelected) onSelect(object.id);
    },
    [object.id, isSelected, onSelect, onAnchorDragStart]
  );

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
      onAnchorDragEnd?.();
      const target = e.target;
      const newX = startX + target.x();
      const newY = startY + target.y();
      if (onAnchorDrop) {
        onAnchorDrop(object.id, "start", newX, newY);
      } else {
        onAnchorMove(object.id, "start", newX, newY);
      }
    },
    [object.id, startX, startY, onAnchorMove, onAnchorDrop, onAnchorDragEnd, stopAnchorBubble]
  );

  const handleAnchor2DragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const endPx = points[points.length - 2] ?? 0;
      const endPy = points[points.length - 1] ?? 0;
      const newX2 = startX + endPx + target.x();
      const newY2 = startY + endPy + target.y();
      onAnchorMove(object.id, "end", newX2, newY2);
    },
    [object.id, startX, startY, points, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor2DragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      onAnchorDragEnd?.();
      const target = e.target;
      const endPx = points[points.length - 2] ?? 0;
      const endPy = points[points.length - 1] ?? 0;
      const newX2 = startX + endPx + target.x();
      const newY2 = startY + endPy + target.y();
      if (onAnchorDrop) {
        onAnchorDrop(object.id, "end", newX2, newY2);
      } else {
        onAnchorMove(object.id, "end", newX2, newY2);
      }
    },
    [object.id, startX, startY, points, onAnchorMove, onAnchorDrop, onAnchorDragEnd, stopAnchorBubble]
  );

  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );

  const color = object.color || DEFAULT_RECT_COLOR;
  const minX = Math.min(0, ...points.filter((_, i) => i % 2 === 0)) - TRASH_CORNER_OFFSET;
  const minY = Math.min(0, ...points.filter((_, i) => i % 2 === 1)) - TRASH_CORNER_OFFSET;
  const maxX = Math.max(0, ...points.filter((_, i) => i % 2 === 0)) + TRASH_CORNER_OFFSET;
  const maxY = Math.max(0, ...points.filter((_, i) => i % 2 === 1)) + TRASH_CORNER_OFFSET;

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
      onContextMenu={(evt) => {
        evt.evt.preventDefault();
        onContextMenu(object.id, "line", evt);
      }}
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
          dash={isDashed ? CONNECTOR_LINE_DASH : undefined}
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
        {showAnchors && (
          <Group
            x={0}
            y={0}
            listening
            onContextMenu={(e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onEndpointContextMenu?.(object.id, "start", { x: startX, y: startY });
            }}
          >
            <Circle
              x={0}
              y={0}
              radius={ANCHOR_HIT_RADIUS}
              fill="transparent"
              listening
              draggable={!hasStartAttachment}
              onDragStart={hasStartAttachment ? undefined : handleAnchorDragStart}
              onDragMove={hasStartAttachment ? undefined : handleAnchor1DragMove}
              onDragEnd={hasStartAttachment ? undefined : handleAnchor1DragEnd}
              onMouseEnter={(e) => {
                if (!hasStartAttachment) {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                }
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "";
              }}
            />
            {!hasStartAttachment && (
              <Circle
                x={0}
                y={0}
                radius={ANCHOR_RADIUS}
                fill="white"
                stroke={getSelectionStroke(color)}
                strokeWidth={SELECTION_STROKE_WIDTH}
                listening={false}
              />
            )}
          </Group>
        )}
        {showAnchors && (
          <Group
            x={points[points.length - 2] ?? 0}
            y={points[points.length - 1] ?? 0}
            listening
            onContextMenu={(e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onEndpointContextMenu?.(object.id, "end", { x: endX, y: endY });
            }}
          >
            <Circle
              x={0}
              y={0}
              radius={ANCHOR_HIT_RADIUS}
              fill="transparent"
              listening
              draggable={!hasEndAttachment}
              onDragStart={hasEndAttachment ? undefined : handleAnchorDragStart}
              onDragMove={hasEndAttachment ? undefined : handleAnchor2DragMove}
              onDragEnd={hasEndAttachment ? undefined : handleAnchor2DragEnd}
              onMouseEnter={(e) => {
                if (!hasEndAttachment) {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                }
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "";
              }}
            />
            {!hasEndAttachment && (
              <Circle
                x={0}
                y={0}
                radius={ANCHOR_RADIUS}
                fill="white"
                stroke={getSelectionStroke(color)}
                strokeWidth={SELECTION_STROKE_WIDTH}
                listening={false}
              />
            )}
          </Group>
        )}
      </Group>
    </Group>
  );
}
