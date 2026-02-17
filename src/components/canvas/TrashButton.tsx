"use client";

import { Group, Rect, Image as KonvaImage } from "react-konva";

type TrashButtonProps = {
  x: number;
  y: number;
  size: number;
  image: HTMLImageElement | null;
  onDelete: () => void;
};

export function TrashButton({ x, y, size, image, onDelete }: TrashButtonProps) {
  return (
    <Group
      x={x}
      y={y}
      draggable={false}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onDelete();
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onDelete();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onDelete();
      }}
    >
      <Rect width={size} height={size} fill="transparent" />
      {image && <KonvaImage image={image} width={size} height={size} />}
    </Group>
  );
}
