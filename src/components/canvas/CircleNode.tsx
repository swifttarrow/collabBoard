"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { ColorPalette, PALETTE_WIDTH, PALETTE_HEIGHT } from "./ColorPalette";
import { TrashButton } from "./TrashButton";
import {
  TRASH_PADDING,
  TRASH_SIZE,
  PALETTE_FLOATING_GAP,
  MIN_CIRCLE_SIZE,
  SELECTION_STROKE,
  SELECTION_STROKE_WIDTH,
} from "./constants";

type CircleObject = BoardObject & { type: "circle" };

type CircleNodeProps = {
  object: CircleObject;
  isSelected: boolean;
  showControls: boolean;
  trashImage: HTMLImageElement | null;
  selectedCircleRef: React.RefObject<Konva.Rect | null>;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, width: number, height: number) => void;
};

export function CircleNode({
  object,
  isSelected,
  showControls,
  trashImage,
  selectedCircleRef,
  onSelect,
  onHover,
  onDelete,
  onColorChange,
  onCustomColor,
  onDragEnd,
  onTransformEnd,
}: CircleNodeProps) {
  const size = Math.max(MIN_CIRCLE_SIZE, Math.min(object.width, object.height));

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
  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Rect;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const nextSize = Math.max(MIN_CIRCLE_SIZE, Math.min(node.width() * scaleX, node.height() * scaleY));
      onTransformEnd(object.id, nextSize, nextSize);
    },
    [object.id, onTransformEnd]
  );
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );
  const handleCustomColor = useCallback(
    () =>
      onCustomColor(object.id, {
        x: object.x + (size - PALETTE_WIDTH) / 2 + PALETTE_WIDTH - 28,
        y: object.y + size + PALETTE_FLOATING_GAP + 14,
      }),
    [object.id, object.x, object.y, size, onCustomColor]
  );

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
    >
      <Rect
        ref={isSelected ? selectedCircleRef : undefined}
        width={size}
        height={size}
        cornerRadius={size / 2}
        fill={object.color}
        stroke={isSelected ? SELECTION_STROKE : undefined}
        strokeWidth={isSelected ? SELECTION_STROKE_WIDTH : 0}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Rect
          x={Math.min(0, (size - PALETTE_WIDTH) / 2)}
          y={size}
          width={
            Math.max(size, (size + PALETTE_WIDTH) / 2) - Math.min(0, (size - PALETTE_WIDTH) / 2)
          }
          height={PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
          fill="transparent"
          listening
        />
      )}
      {showControls && (
        <>
          <TrashButton
            x={size - TRASH_SIZE - TRASH_PADDING}
            y={TRASH_PADDING}
            size={TRASH_SIZE}
            image={trashImage}
            onDelete={handleDelete}
          />
          <ColorPalette
            x={(size - PALETTE_WIDTH) / 2}
            y={size + PALETTE_FLOATING_GAP}
            currentColor={object.color}
            onSelectColor={handleColorChange}
            onCustomColor={handleCustomColor}
          />
        </>
      )}
    </Group>
  );
}
