"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardObject } from "@/lib/board/types";
import type { ViewportState } from "@/lib/board/types";

type StickyObject = BoardObject & { type: "sticky" };

type StickyTextEditOverlayProps = {
  object: StickyObject;
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  onSave: (text: string) => void;
  onCancel: () => void;
};

export function StickyTextEditOverlay({
  object,
  viewport,
  stageWidth,
  stageHeight,
  onSave,
  onCancel,
}: StickyTextEditOverlayProps) {
  const [value, setValue] = useState(object.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Shift+Enter: insert newline at cursor
          e.preventDefault();
          const textarea = e.currentTarget;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = value.slice(0, start) + "\n" + value.slice(end);
          setValue(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          });
        } else {
          // Enter alone: save
          e.preventDefault();
          onSave(value.trim());
        }
      }
    },
    [value, onSave, onCancel]
  );

  const handleBlur = useCallback(() => {
    onSave(value.trim());
  }, [value, onSave]);

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + object.x * scale;
  const top = vy + object.y * scale;
  const width = object.width * scale;
  const height = object.height * scale;

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-20"
      style={{ width: stageWidth, height: stageHeight }}
      aria-label="Edit sticky note text"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="resize-none rounded-xl border-2 border-slate-300 bg-amber-50 p-3 text-base text-slate-800 shadow-lg outline-none focus:border-blue-500"
        style={{
          position: "absolute",
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
          padding: 12,
          boxSizing: "border-box",
        }}
        rows={4}
      />
    </div>
  );
}
