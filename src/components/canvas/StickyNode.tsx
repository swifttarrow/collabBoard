"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect, Text } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { ColorPalette, PALETTE_WIDTH, PALETTE_HEIGHT } from "./ColorPalette";
import { TrashButton } from "./TrashButton";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_PADDING,
  TRASH_SIZE,
  TRASH_CORNER_OFFSET,
  PALETTE_FLOATING_GAP,
  SELECTION_STROKE_WIDTH,
  STICKY_CORNER_RADIUS,
  STICKY_TEXT_FILL,
  STICKY_FONT_SIZE,
  STICKY_TEXT_PADDING,
  STICKY_SHADOW,
  DEFAULT_STICKY_COLOR,
} from "./constants";

type StickyObject = BoardObject & { type: "sticky" };

type StickyNodeProps = {
  object: StickyObject;
  isSelected: boolean;
  showControls: boolean;
  draggable?: boolean;
  trashImage: HTMLImageElement | null;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onStartEdit: (id: string) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function StickyNode({
  object,
  isSelected,
  showControls,
  draggable = true,
  trashImage,
  onSelect,
  onHover,
  onDelete,
  onColorChange,
  onCustomColor,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStartEdit,
  registerNodeRef,
}: StickyNodeProps) {
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; // Select deepest node; prevent frame from overwriting when object is inside frame
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
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd (would overwrite frame position)
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleDblClick = useCallback(() => onStartEdit(object.id), [object.id, onStartEdit]);
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );
  const handleCustomColor = useCallback(
    () =>
      onCustomColor(object.id, {
        x: object.x + (object.width - PALETTE_WIDTH) / 2 + PALETTE_WIDTH - 28,
        y: object.y + object.height + PALETTE_FLOATING_GAP + 14,
      }),
    [object.id, object.x, object.y, object.width, object.height, onCustomColor]
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
    >
      {/* Expanded hit area when selected: keeps hover (and trash visible) when cursor moves to trash/palette */}
      {isSelected && (
        <Rect
          x={-TRASH_CORNER_OFFSET}
          y={-TRASH_CORNER_OFFSET}
          width={object.width + 2 * TRASH_CORNER_OFFSET}
          height={object.height + TRASH_CORNER_OFFSET + PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
          fill="transparent"
          listening
        />
      )}
      {/* Inner Group: shape only — Transformer attaches here for snug selection box */}
      <Group name={object.id} ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)}>
        <Rect
          width={object.width}
          height={object.height}
          fill={object.color}
          stroke={isSelected ? getSelectionStroke(object.color || DEFAULT_STICKY_COLOR) : undefined}
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
      </Group>
      {/* Hit area so clicks between shape and palette keep selection */}
      {isSelected && (
        <Rect
          x={Math.min(0, (object.width - PALETTE_WIDTH) / 2)}
          y={object.height}
          width={
            Math.max(object.width, (object.width + PALETTE_WIDTH) / 2) -
            Math.min(0, (object.width - PALETTE_WIDTH) / 2)
          }
          height={PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
          fill="transparent"
          listening
        />
      )}
      {showControls && (
        <>
          <TrashButton
            x={object.width + TRASH_CORNER_OFFSET - TRASH_SIZE}
            y={-TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={trashImage}
            onDelete={handleDelete}
          />
          <ColorPalette
            x={(object.width - PALETTE_WIDTH) / 2}
            y={object.height + PALETTE_FLOATING_GAP}
            currentColor={object.color}
            onSelectColor={handleColorChange}
            onCustomColor={handleCustomColor}
          />
        </>
      )}
    </Group>
  );
}
