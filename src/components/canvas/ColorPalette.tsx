"use client";

import { Group, Rect } from "react-konva";
import {
  COLOR_PRESETS,
  COLOR_SWATCH_GAP,
  COLOR_SWATCH_SIZE,
  COLOR_SELECTED_STROKE,
  COLOR_SELECTED_STROKE_WIDTH,
} from "./constants";
import { TrashButton } from "./TrashButton";

type ColorPaletteProps = {
  x: number;
  y: number;
  currentColor: string;
  trashImage: HTMLImageElement | null;
  onSelectColor: (color: string) => void;
  onCustomColor?: () => void;
  onDelete: () => void;
};

export function ColorPalette({
  x,
  y,
  currentColor,
  trashImage,
  onSelectColor,
  onCustomColor,
  onDelete,
}: ColorPaletteProps) {
  void onCustomColor; // reserved for custom color picker UI (e.g. StickyNode)
  const colorStripHeight =
    COLOR_SWATCH_SIZE * COLOR_PRESETS.length + COLOR_SWATCH_GAP * (COLOR_PRESETS.length - 1);
  const trashY = colorStripHeight + COLOR_SWATCH_GAP;

  return (
    <Group x={x} y={y} draggable={false}>
      {COLOR_PRESETS.map((color, index) => (
        <Rect
          key={color}
          y={index * (COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP)}
          width={COLOR_SWATCH_SIZE}
          height={COLOR_SWATCH_SIZE}
          fill={color}
          cornerRadius={999}
          stroke={color.toLowerCase() === currentColor.toLowerCase() ? COLOR_SELECTED_STROKE : "#0f172a"}
          strokeWidth={
            color.toLowerCase() === currentColor.toLowerCase() ? COLOR_SELECTED_STROKE_WIDTH : 0.5
          }
          onMouseDown={(event) => {
            event.cancelBubble = true;
            onSelectColor(color);
          }}
          onClick={(event) => {
            event.cancelBubble = true;
            onSelectColor(color);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            onSelectColor(color);
          }}
        />
      ))}
      <TrashButton
        x={0}
        y={trashY}
        size={COLOR_SWATCH_SIZE}
        image={trashImage}
        onDelete={onDelete}
      />
    </Group>
  );
}
