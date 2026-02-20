"use client";

import { Group, Rect, Image as KonvaImage } from "react-konva";

type DuplicateButtonProps = {
  x: number;
  y: number;
  size: number;
  image: HTMLImageElement | null;
  onDuplicate: () => void;
};

export function DuplicateButton({
  x,
  y,
  size,
  image,
  onDuplicate,
}: DuplicateButtonProps) {
  return (
    <Group
      x={x}
      y={y}
      draggable={false}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onDuplicate();
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onDuplicate();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onDuplicate();
      }}
    >
      <Rect width={size} height={size} fill="transparent" />
      {image && <KonvaImage image={image} width={size} height={size} />}
    </Group>
  );
}
