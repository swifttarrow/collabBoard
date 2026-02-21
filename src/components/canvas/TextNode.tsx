"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import {
  TRASH_CORNER_OFFSET,
  CONNECTOR_TARGET_STROKE,
  CONNECTOR_TARGET_STROKE_WIDTH,
} from "./constants";

type TextObject = BoardObject & { type: "text" };

type TextNodeProps = {
  object: TextObject;
  isSelected: boolean;
  showControls: boolean;
  isConnectionTarget?: boolean;
  draggable?: boolean;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onContextMenu: (
    id: string,
    objectType: "text",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onStartEdit: (id: string) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function TextNode({
  object,
  isSelected,
  showControls,
  isConnectionTarget = false,
  draggable = true,
  onSelect,
  onHover,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStartEdit,
  registerNodeRef,
}: TextNodeProps) {
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
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
      e.cancelBubble = true;
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleDblClick = useCallback(() => onStartEdit(object.id), [object.id, onStartEdit]);
  const handleContextMenu = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt.preventDefault();
      onContextMenu(object.id, "text", evt);
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
      onDblClick={handleDblClick}
      onContextMenu={handleContextMenu}
    >
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
      <Group
        name={object.id}
        rotation={object.rotation ?? 0}
        ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)}
      >
        {/* Transparent hit area - must have listening=true so clicks/dblclicks register for editing */}
        <Rect
          width={object.width}
          height={object.height}
          fill="transparent"
          stroke={isConnectionTarget ? CONNECTOR_TARGET_STROKE : undefined}
          strokeWidth={isConnectionTarget ? CONNECTOR_TARGET_STROKE_WIDTH : 0}
        />
      </Group>
    </Group>
  );
}
