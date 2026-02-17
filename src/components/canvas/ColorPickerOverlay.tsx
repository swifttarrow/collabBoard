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
    inputRef.current?.focus();
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
        className="absolute rounded-full border border-slate-900 bg-white p-1 shadow-lg"
        style={{ left: Math.round(left), top: Math.round(top) }}
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onClose}
          className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
}
