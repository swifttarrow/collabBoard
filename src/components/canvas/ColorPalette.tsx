"use client";

import { Group, Rect, Text } from "react-konva";
import {
  COLOR_PRESETS,
  COLOR_SWATCH_GAP,
  COLOR_SWATCH_SIZE,
  COLOR_SWATCH_PADDING,
  COLOR_SELECTED_STROKE,
  COLOR_SELECTED_STROKE_WIDTH,
} from "./constants";

function isColorDark(hex: string): boolean {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return false;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return l < 0.5;
}

const PALETTE_SWATCH_COUNT = COLOR_PRESETS.length + 1;
export const PALETTE_WIDTH =
  COLOR_SWATCH_PADDING * 2 +
  PALETTE_SWATCH_COUNT * COLOR_SWATCH_SIZE +
  (PALETTE_SWATCH_COUNT - 1) * COLOR_SWATCH_GAP;
export const PALETTE_HEIGHT = COLOR_SWATCH_PADDING * 2 + COLOR_SWATCH_SIZE;

type ColorPaletteProps = {
  x: number;
  y: number;
  currentColor: string;
  onSelectColor: (color: string) => void;
  onCustomColor: () => void;
};

export function ColorPalette({
  x,
  y,
  currentColor,
  onSelectColor,
  onCustomColor,
}: ColorPaletteProps) {
  const isPreset = COLOR_PRESETS.some(
    (c) => c.toLowerCase() === currentColor.toLowerCase()
  );

  const handleInteraction = (fn: () => void) => (e: { cancelBubble?: boolean }) => {
    e.cancelBubble = true;
    fn();
  };

  return (
    <Group x={x} y={y} draggable={false}>
      <Rect
        x={0}
        y={0}
        width={PALETTE_WIDTH}
        height={PALETTE_HEIGHT}
        fill="rgba(255,255,255,0.98)"
        stroke="#e2e8f0"
        strokeWidth={1}
        cornerRadius={10}
        shadowColor="#000"
        shadowBlur={8}
        shadowOpacity={0.12}
      />
      {COLOR_PRESETS.map((color, index) => (
        <Rect
          key={color}
          x={COLOR_SWATCH_PADDING + index * (COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP)}
          y={COLOR_SWATCH_PADDING}
          width={COLOR_SWATCH_SIZE}
          height={COLOR_SWATCH_SIZE}
          fill={color}
          cornerRadius={999}
          stroke={
            color.toLowerCase() === currentColor.toLowerCase()
              ? COLOR_SELECTED_STROKE
              : "#cbd5e1"
          }
          strokeWidth={
            color.toLowerCase() === currentColor.toLowerCase()
              ? COLOR_SELECTED_STROKE_WIDTH
              : 0.5
          }
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = "pointer";
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = "";
          }}
          onMouseDown={handleInteraction(() => onSelectColor(color))}
          onClick={handleInteraction(() => onSelectColor(color))}
          onTap={handleInteraction(() => onSelectColor(color))}
        />
      ))}
      <Group
        x={
          COLOR_SWATCH_PADDING +
          COLOR_PRESETS.length * (COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP)
        }
        y={COLOR_SWATCH_PADDING}
        onMouseEnter={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "pointer";
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "";
        }}
        onMouseDown={handleInteraction(onCustomColor)}
        onClick={handleInteraction(onCustomColor)}
        onTap={handleInteraction(onCustomColor)}
      >
        <Rect
          width={COLOR_SWATCH_SIZE}
          height={COLOR_SWATCH_SIZE}
          fill={!isPreset ? currentColor : "#e2e8f0"}
          stroke={!isPreset ? COLOR_SELECTED_STROKE : "#94a3b8"}
          strokeWidth={!isPreset ? COLOR_SELECTED_STROKE_WIDTH : 0.5}
          cornerRadius={999}
        />
        <Text
          text="+"
          width={COLOR_SWATCH_SIZE}
          height={COLOR_SWATCH_SIZE}
          align="center"
          verticalAlign="middle"
          fontSize={16}
          fontStyle="bold"
          fill={
            !isPreset && isColorDark(currentColor) ? "#ffffff" : "#64748b"
          }
          listening={false}
        />
      </Group>
    </Group>
  );
}
