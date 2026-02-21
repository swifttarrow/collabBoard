"use client";

import { useEffect, useRef } from "react";
import type { ViewportState } from "@/lib/board/types";

type ColorPickerOverlayProps = {
  anchor: { x: number; y: number };
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
};

export function ColorPickerOverlay({
  anchor,
  viewport,
  stageWidth,
  stageHeight,
  value,
  onChange,
  onClose,
}: ColorPickerOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Open the native color picker immediately; input is positioned near the object
    inputRef.current?.click();
  }, []);

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + anchor.x * scale;
  const top = vy + anchor.y * scale;

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-30"
      style={{ width: stageWidth, height: stageHeight }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="absolute h-8 w-8 opacity-0 overflow-hidden"
        style={{ left: Math.round(left), top: Math.round(top) }}
        aria-hidden
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onClose}
        />
      </div>
    </div>
  );
}
