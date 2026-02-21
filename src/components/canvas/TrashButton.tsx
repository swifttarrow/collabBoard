"use client";

import { Group, Rect, Image as KonvaImage } from "react-konva";
import {
  FLOATING_BUTTON_FILL,
  FLOATING_BUTTON_STROKE,
  FLOATING_BUTTON_STROKE_WIDTH,
  FLOATING_BUTTON_CORNER_RADIUS,
} from "./constants";

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
      <Rect
        width={size}
        height={size}
        fill={FLOATING_BUTTON_FILL}
        stroke={FLOATING_BUTTON_STROKE}
        strokeWidth={FLOATING_BUTTON_STROKE_WIDTH}
        cornerRadius={FLOATING_BUTTON_CORNER_RADIUS}
      />
      {image && <KonvaImage image={image} width={size} height={size} listening={false} />}
    </Group>
  );
}
