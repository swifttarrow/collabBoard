"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { TrashButton } from "./TrashButton";
import { TRASH_SIZE, TRASH_CORNER_OFFSET, TEXT_SELECTION_PADDING } from "./constants";

type TextObject = BoardObject & { type: "text" };

type TextNodeProps = {
  object: TextObject;
  isSelected: boolean;
  showControls: boolean;
  draggable?: boolean;
  trashImage: HTMLImageElement | null;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
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
  draggable = true,
  trashImage,
  onSelect,
  onHover,
  onDelete,
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
  const handleDragStart = useCallback(() => {
    onDragStart?.(object.id);
  }, [object.id, onDragStart]);
  const handleDragMove = useCallback(
    (e: { target: { name: () => string; x: () => number; y: () => number } }) => {
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
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);

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
      <Group name={object.id} ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)}>
        {/* Transparent hit area - must have listening=true so clicks/dblclicks register for editing */}
        <Rect width={object.width} height={object.height} fill="transparent" />
      </Group>
      {showControls && (
        <TrashButton
          x={object.width - TRASH_SIZE - TEXT_SELECTION_PADDING}
          y={TEXT_SELECTION_PADDING}
          size={TRASH_SIZE}
          image={trashImage}
          onDelete={handleDelete}
        />
      )}
    </Group>
  );
}
