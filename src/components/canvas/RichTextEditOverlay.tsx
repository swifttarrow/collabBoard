"use client";

import { useCallback, useRef } from "react";
import type { BoardObject } from "@/lib/board/types";
import type { ViewportState } from "@/lib/board/types";
import { RichTextEditor } from "./RichTextEditor";

type TextObject = BoardObject & { type: "text" };
type StickyObject = BoardObject & { type: "sticky" };
type EditableObject = TextObject | StickyObject;

type RichTextEditOverlayProps = {
  object: EditableObject;
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  onSave: (text: string) => void;
  onCancel: () => void;
  /** For stickies: rounded with background. For text: minimal border. */
  variant: "sticky" | "text";
};

export function RichTextEditOverlay({
  object,
  viewport,
  stageWidth,
  stageHeight,
  onSave,
  onCancel,
  variant,
}: RichTextEditOverlayProps) {
  void onCancel; // Reserved for Escape-to-cancel
  const lastSavedRef = useRef(object.text);

  const handleUpdate = useCallback(
    (html: string) => {
      lastSavedRef.current = html;
    },
    []
  );

  const handleBlur = useCallback(() => {
    onSave(lastSavedRef.current.trim() || "");
  }, [onSave]);

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + object.x * scale;
  const top = vy + object.y * scale;
  const width = object.width * scale;
  const height = object.height * scale;

  const isSticky = variant === "sticky";

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-20"
      style={{ width: stageWidth, height: stageHeight }}
      aria-label={isSticky ? "Edit sticky note text" : "Edit text"}
    >
      <div
        className={isSticky ? "rounded-xl border-2 border-slate-300 bg-amber-50 shadow-lg" : "rounded border border-slate-300 bg-white shadow-md"}
        style={{
          position: "absolute",
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
          padding: 12,
          boxSizing: "border-box",
        }}
      >
        <RichTextEditor
          content={object.text}
          onUpdate={handleUpdate}
          onBlur={handleBlur}
          editable
          className="h-full w-full text-base text-slate-800"
        />
      </div>
    </div>
  );
}
