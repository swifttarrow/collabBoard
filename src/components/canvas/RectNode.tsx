"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_CORNER_OFFSET,
  SELECTION_STROKE_WIDTH,
  RECT_CORNER_RADIUS,
  DEFAULT_RECT_COLOR,
  COLOR_NONE,
  CONNECTOR_TARGET_STROKE,
  CONNECTOR_TARGET_STROKE_WIDTH,
} from "./constants";

type RectObject = BoardObject & { type: "rect" };

type RectNodeProps = {
  object: RectObject;
  isSelected: boolean;
  showControls: boolean;
  isConnectionTarget?: boolean;
  draggable?: boolean;
  registerNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onContextMenu: (
    id: string,
    objectType: "rect",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
};

export function RectNode({
  object,
  isSelected,
  showControls: _,
  isConnectionTarget = false,
  draggable = true,
  registerNodeRef,
  onSelect,
  onHover,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
}: RectNodeProps) {
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; // Select deepest node; prevent frame from overwriting when object is inside frame
      onSelect(object.id, e.evt.shiftKey);
    },
    [object.id, onSelect]
  );
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      onDragStart?.(object.id);
    },
    [object.id, onDragStart]
  );
  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      const target = e.target;
      if (target?.name() && onDragMove) {
        onDragMove(target.name(), target.x(), target.y());
      }
    },
    [onDragMove]
  );
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd (would overwrite frame position)
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleContextMenu = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt.preventDefault();
      onContextMenu(object.id, "rect", evt);
    },
    [object.id, onContextMenu]
  );
  return (
    <Group
      key={object.id}
      name={object.id}
      x={object.x}
      y={object.y}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {/* Expanded hit area when selected */}
      {isSelected && (
        <Rect
          x={-TRASH_CORNER_OFFSET}
          y={-TRASH_CORNER_OFFSET}
          width={object.width + 2 * TRASH_CORNER_OFFSET}
          height={object.height + 2 * TRASH_CORNER_OFFSET}
          fill="transparent"
          listening
        />
      )}
      {/* Inner Group: shape only — Transformer attaches here for snug selection box */}
      <Group
        name={object.id}
        rotation={object.rotation ?? 0}
        ref={(node) => registerNodeRef(object.id, isSelected ? node : null)}
      >
        <Rect
          width={object.width}
          height={object.height}
          fill={object.color === COLOR_NONE ? "transparent" : (object.color || DEFAULT_RECT_COLOR)}
          stroke={
            isConnectionTarget
              ? CONNECTOR_TARGET_STROKE
              : isSelected
                ? getSelectionStroke(object.color === COLOR_NONE ? DEFAULT_RECT_COLOR : (object.color || DEFAULT_RECT_COLOR))
                : undefined
          }
          strokeWidth={
            isConnectionTarget ? CONNECTOR_TARGET_STROKE_WIDTH : isSelected ? SELECTION_STROKE_WIDTH : 0
          }
          cornerRadius={RECT_CORNER_RADIUS}
        />
      </Group>
    </Group>
  );
}
