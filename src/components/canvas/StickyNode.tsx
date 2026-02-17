"use client";

import { useCallback } from "react";
import { Group, Rect, Text } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { TrashButton } from "./TrashButton";
import {
  TRASH_SIZE,
  TRASH_PADDING,
  SELECTION_STROKE,
  SELECTION_STROKE_WIDTH,
  STICKY_CORNER_RADIUS,
  STICKY_TEXT_FILL,
  STICKY_FONT_SIZE,
  STICKY_TEXT_PADDING,
  STICKY_SHADOW,
} from "./constants";

type StickyObject = BoardObject & { type: "sticky" };

type StickyNodeProps = {
  object: StickyObject;
  isSelected: boolean;
  showTrash: boolean;
  trashImage: HTMLImageElement | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onStartEdit: (id: string) => void;
};

export function StickyNode({
  object,
  isSelected,
  showTrash,
  trashImage,
  onSelect,
  onHover,
  onDelete,
  onDragEnd,
  onStartEdit,
}: StickyNodeProps) {
  const handleClick = useCallback(() => onSelect(object.id), [object.id, onSelect]);
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const handleDragEnd = useCallback(
    (e: { target: { name: () => string; x: () => number; y: () => number } }) => {
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleDblClick = useCallback(() => onStartEdit(object.id), [object.id, onStartEdit]);
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);

  return (
    <Group
      key={object.id}
      name={object.id}
      x={object.x}
      y={object.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDblClick={handleDblClick}
    >
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color}
        stroke={isSelected ? SELECTION_STROKE : undefined}
        strokeWidth={isSelected ? SELECTION_STROKE_WIDTH : 0}
        cornerRadius={STICKY_CORNER_RADIUS}
        shadowColor={STICKY_SHADOW.color}
        shadowBlur={STICKY_SHADOW.blur}
        shadowOpacity={STICKY_SHADOW.opacity}
      />
      <Text
        text={object.text}
        fill={STICKY_TEXT_FILL}
        fontSize={STICKY_FONT_SIZE}
        width={object.width}
        height={object.height}
        padding={STICKY_TEXT_PADDING}
        listening={false}
      />
      {showTrash && (
        <TrashButton
          x={object.width - TRASH_SIZE - TRASH_PADDING}
          y={TRASH_PADDING}
          size={TRASH_SIZE}
          image={trashImage}
          onDelete={handleDelete}
        />
      )}
    </Group>
  );
}
