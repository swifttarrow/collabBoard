"use client";

import React, { useCallback, useRef } from "react";
import type { BoardObject } from "@/lib/board/types";
import type { ViewportState } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { RichTextEditor } from "./RichTextEditor";
import { htmlToPlainText } from "@/lib/html-utils";
import { FRAME_HEADER_HEIGHT, DEFAULT_FRAME_COLOR } from "./constants";

type TextObject = BoardObject & { type: "text" };
type StickyObject = BoardObject & { type: "sticky" };
type FrameObject = BoardObject & { type: "frame" };
type EditableObject = TextObject | StickyObject | FrameObject;

type RichTextEditOverlayProps = {
  object: EditableObject;
  objects: Record<string, BoardObjectWithMeta>;
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  onSave: (text: string) => void;
  onCancel: () => void;
  /** For stickies: rounded with background. For text: minimal border. For frame: header-only. */
  variant: "sticky" | "text" | "frame";
};

export function RichTextEditOverlay({
  object,
  objects,
  viewport,
  stageWidth,
  stageHeight,
  onSave,
  onCancel,
  variant,
}: RichTextEditOverlayProps) {
  void onCancel; // Reserved for Escape-to-cancel
  const lastSavedRef = useRef(object.text);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleUpdate = useCallback(
    (html: string) => {
      lastSavedRef.current = html;
    },
    []
  );

  const handleBlur = useCallback(
    () => {
      let text = lastSavedRef.current.trim() || "";
      if (variant === "frame") {
        text = htmlToPlainText(text);
      }
      onSave(text);
    },
    [onSave, variant]
  );

  const { x: vx, y: vy, scale } = viewport;
  const abs = getAbsolutePosition(object.id, objects);
  const left = vx + abs.x * scale;
  const top = vy + abs.y * scale;

  const isFrame = variant === "frame";
  const headerHeight =
    isFrame ? Math.min(FRAME_HEADER_HEIGHT, object.height / 3) : object.height;
  const width = object.width * scale;
  const height = headerHeight * scale;

  const isSticky = variant === "sticky";

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-20"
      style={{ width: stageWidth, height: stageHeight }}
      aria-label={
        isSticky ? "Edit sticky note text" : isFrame ? "Edit frame title" : "Edit text"
      }
    >
      <div
        className={
          isSticky
            ? "rounded-xl border-2 border-slate-300 shadow-lg"
            : isFrame
              ? "rounded-t-lg border-2 border-slate-300 border-b-transparent shadow-md"
              : "rounded border border-slate-300 shadow-md"
        }
        style={{
          position: "absolute",
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
          padding: 12,
          boxSizing: "border-box",
          backgroundColor: isSticky
            ? "#FEF3C7"
            : isFrame
              ? object.color || DEFAULT_FRAME_COLOR
              : "#ffffff",
        }}
      >
        <RichTextEditor
          content={isFrame ? htmlToPlainText(object.text || "") : object.text}
          onUpdate={handleUpdate}
          onBlur={handleBlur}
          blurExcludeRef={editorContainerRef}
          editorContainerRef={editorContainerRef}
          editable
          className="h-full w-full text-base text-slate-800"
        />
      </div>
    </div>
  );
}
