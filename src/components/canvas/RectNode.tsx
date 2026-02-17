"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { ColorPalette } from "./ColorPalette";
import {
  TRASH_PADDING,
  COLOR_SWATCH_PADDING,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  COLOR_SWATCH_SIZE,
  SELECTION_STROKE,
  SELECTION_STROKE_WIDTH,
  RECT_CORNER_RADIUS,
} from "./constants";

type RectObject = BoardObject & { type: "rect" };

type RectNodeProps = {
  object: RectObject;
  isSelected: boolean;
  showControls: boolean;
  trashImage: HTMLImageElement | null;
  selectedRectRef: React.RefObject<Konva.Rect | null>;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor?: (id: string, anchor: { x: number; y: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, width: number, height: number) => void;
};

export function RectNode({
  object,
  isSelected,
  showControls,
  trashImage,
  selectedRectRef,
  onSelect,
  onHover,
  onDelete,
  onColorChange,
  onCustomColor,
  onDragEnd,
  onTransformEnd,
}: RectNodeProps) {
  void onCustomColor;
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
      const nextWidth = Math.max(MIN_RECT_WIDTH, node.width() * scaleX);
      const nextHeight = Math.max(MIN_RECT_HEIGHT, node.height() * scaleY);
      onTransformEnd(object.id, nextWidth, nextHeight);
    },
    [object.id, onTransformEnd]
  );
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
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
        ref={isSelected ? selectedRectRef : undefined}
        width={object.width}
        height={object.height}
        fill={object.color}
        stroke={isSelected ? SELECTION_STROKE : undefined}
        strokeWidth={isSelected ? SELECTION_STROKE_WIDTH : 0}
        cornerRadius={RECT_CORNER_RADIUS}
        onTransformEnd={handleTransformEnd}
      />
      {showControls && (
        <ColorPalette
          x={object.width - COLOR_SWATCH_SIZE - COLOR_SWATCH_PADDING}
          y={TRASH_PADDING}
          currentColor={object.color}
          trashImage={trashImage}
          onSelectColor={handleColorChange}
          onDelete={handleDelete}
        />
      )}
    </Group>
  );
}
