"use client";

import React, { useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import {
  getAbsolutePosition,
  getStickyTextInRenderOrder,
} from "@/lib/board/scene-graph";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  STICKY_TEXT_FILL,
  STICKY_FONT_SIZE,
  STICKY_TEXT_PADDING,
  STICKY_CORNER_RADIUS,
  STICKY_SHADOW,
  DEFAULT_STICKY_COLOR,
  DEFAULT_TEXT_COLOR,
  COLOR_NONE,
  SELECTION_STROKE,
  SELECTION_STROKE_WIDTH,
} from "./constants";
import { RichTextEditor } from "./RichTextEditor";

type RichTextDisplayLayerProps = {
  objects: Record<string, BoardObjectWithMeta>;
  selection: string[];
  viewport: { x: number; y: number; scale: number };
  stageWidth: number;
  stageHeight: number;
  /** Id of object being edited - render editor inline */
  editingId: string | null;
  /** Called when inline edit is saved (blur or click-outside) */
  onSaveEdit?: (text: string) => void;
};

const CULL_MARGIN_SCREEN_PX = 240;

/** Renders HTML content for stickies and text nodes as positioned overlays. */
export function RichTextDisplayLayer({
  objects,
  selection,
  viewport,
  stageWidth,
  stageHeight,
  editingId,
  onSaveEdit,
}: RichTextDisplayLayerProps) {
  const { x: vx, y: vy, scale } = viewport;
  const worldMargin = CULL_MARGIN_SCREEN_PX / Math.max(scale, 0.01);
  const viewportWorld = {
    minX: (-vx) / scale - worldMargin,
    minY: (-vy) / scale - worldMargin,
    maxX: (stageWidth - vx) / scale + worldMargin,
    maxY: (stageHeight - vy) / scale + worldMargin,
  };

  const textObjects = getStickyTextInRenderOrder(objects, selection);
  const editorBoxRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>("");

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (onSaveEdit && !editorBoxRef.current?.contains(e.target as Node)) {
        onSaveEdit(lastSavedRef.current.trim() || "");
      }
    },
    [onSaveEdit]
  );

  const handleEditorUpdate = useCallback((html: string) => {
    lastSavedRef.current = html;
  }, []);

  const handleEditorBlur = useCallback(
    () => {
      if (onSaveEdit) {
        onSaveEdit(lastSavedRef.current.trim() || "");
      }
    },
    [onSaveEdit]
  );

  const isEditing = !!editingId && !!onSaveEdit;

  return (
    <div
      className={`absolute left-0 top-0 z-10 ${isEditing ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ width: stageWidth, height: stageHeight }}
      aria-hidden
    >
      {isEditing && (
        <div
          className="absolute z-0"
          style={{ left: 0, top: 0, width: stageWidth, height: stageHeight }}
          onClick={handleBackdropClick}
          aria-hidden
        />
      )}
      {textObjects.map((obj, index) => {
        const abs = getAbsolutePosition(obj.id, objects);
        const isSelected = selection.includes(obj.id);
        const intersectsViewport = !(
          abs.x + obj.width < viewportWorld.minX ||
          abs.x > viewportWorld.maxX ||
          abs.y + obj.height < viewportWorld.minY ||
          abs.y > viewportWorld.maxY
        );
        if (!isSelected && !intersectsViewport) {
          return null;
        }
        const left = vx + abs.x * scale;
        const top = vy + abs.y * scale;
        const width = obj.width * scale;
        const height = obj.height * scale;
        const isSticky = obj.type === "sticky";
        const textBorderStyle = (obj.data as { borderStyle?: "none" | "solid" } | undefined)?.borderStyle ?? "none";
        const isEditingThis = obj.id === editingId;

        if (isEditingThis) {
          lastSavedRef.current = obj.text ?? "";
        }

        const textBgColor = !isSticky
          ? (obj.color === COLOR_NONE ? undefined : (obj.color ?? DEFAULT_TEXT_COLOR))
          : undefined;
        const textHasBorder = !isSticky && textBorderStyle === "solid";

        const containerStyle: React.CSSProperties = {
          zIndex: isEditingThis ? 9999 : index,
          position: "absolute",
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
          transform: (obj.rotation ?? 0) !== 0 ? `rotate(${obj.rotation}deg)` : undefined,
          transformOrigin: "0 0",
          overflow: "hidden",
          borderRadius: isSticky ? STICKY_CORNER_RADIUS * scale : 4,
          ...(isSticky && {
            display: "flex",
            alignItems: "flex-start",
            backgroundColor: obj.color === COLOR_NONE ? "transparent" : (obj.color ?? DEFAULT_STICKY_COLOR),
            boxShadow: obj.color === COLOR_NONE ? undefined : `0 2px ${STICKY_SHADOW.blur}px rgba(0,0,0,${STICKY_SHADOW.opacity})`,
            ...(isSelected && {
              outline: `${SELECTION_STROKE_WIDTH}px solid ${obj.color === COLOR_NONE ? SELECTION_STROKE : getSelectionStroke(obj.color ?? DEFAULT_STICKY_COLOR)}`,
              outlineOffset: -SELECTION_STROKE_WIDTH,
            }),
          }),
          ...(textBgColor && { backgroundColor: textBgColor }),
          ...(textHasBorder && {
            border: `1px solid ${isSelected ? "#94a3b8" : "#cbd5e1"}`,
            boxSizing: "border-box" as const,
          }),
          ...(!isSticky && {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
          }),
        };

        if (isEditingThis) {
          const editorContentStyle: React.CSSProperties = isSticky
            ? {
                padding: STICKY_TEXT_PADDING * scale,
                boxSizing: "border-box",
                fontSize: STICKY_FONT_SIZE * scale,
                flex: 1,
                minWidth: 0,
                minHeight: 0,
              }
            : {
                width: obj.width,
                height: obj.height,
                padding: STICKY_TEXT_PADDING,
                boxSizing: "border-box",
                fontSize: STICKY_FONT_SIZE,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                textAlign: "left",
              };

          const editorWrapperClass = isSticky
            ? "overflow-hidden overflow-y-auto break-words h-full w-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-0 [&_.ProseMirror]:m-0 [&_p]:m-0 [&_p]:leading-relaxed [&_h1]:font-bold [&_h1]:text-[1.125em] [&_h2]:font-bold [&_h2]:text-[1em] [&_h3]:font-semibold [&_h3]:text-[0.875em] [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:text-[0.875em] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            : "overflow-hidden overflow-y-auto break-words h-full w-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-0 [&_.ProseMirror]:m-0 [&_.ProseMirror]:flex [&_.ProseMirror]:flex-col [&_.ProseMirror]:items-start [&_.ProseMirror]:justify-start [&_.ProseMirror]:leading-[1.625] [&_.ProseMirror]:text-left [&_p]:m-0 [&_p]:leading-relaxed [&_p]:min-h-[1.5em] [&_h1]:font-bold [&_h1]:text-[1.125em] [&_h2]:font-bold [&_h2]:text-[1em] [&_h3]:font-semibold [&_h3]:text-[0.875em] [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:text-[0.875em] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4";

          return (
            <div
              key={obj.id}
              ref={editorBoxRef}
              style={{
                ...containerStyle,
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={editorWrapperClass}
                style={{
                  ...editorContentStyle,
                  color: STICKY_TEXT_FILL,
                }}
              >
                <RichTextEditor
                  content={obj.text ?? ""}
                  onUpdate={handleEditorUpdate}
                  onBlur={handleEditorBlur}
                  blurExcludeRef={editorContainerRef}
                  editorContainerRef={editorContainerRef}
                  editable
                  autoFocus
                  appendMenuToBody
                  className="h-full w-full"
                />
              </div>
            </div>
          );
        }

        // Display mode: static HTML
        const textContent = (
          <div
            className="overflow-hidden overflow-y-auto break-words [&_p]:m-0 [&_p]:leading-relaxed [&_h1]:font-bold [&_h1]:text-[1.125em] [&_h2]:font-bold [&_h2]:text-[1em] [&_h3]:font-semibold [&_h3]:text-[0.875em] [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:text-[0.875em] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            style={{
              ...(isSticky
                ? {
                    padding: STICKY_TEXT_PADDING * scale,
                    boxSizing: "border-box" as const,
                    fontSize: STICKY_FONT_SIZE * scale,
                  }
                : {
                    width: obj.width,
                    height: obj.height,
                    padding: STICKY_TEXT_PADDING,
                    boxSizing: "border-box" as const,
                    fontSize: STICKY_FONT_SIZE,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    textAlign: "left",
                  }),
              color: STICKY_TEXT_FILL,
            }}
            dangerouslySetInnerHTML={{ __html: formatContent(obj.text ?? "") }}
          />
        );

        return (
          <div
            key={obj.id}
            style={{
              ...containerStyle,
              pointerEvents: isEditing ? "none" : undefined,
            }}
          >
            {textContent}
          </div>
        );
      })}
    </div>
  );
}

/** Sanitize HTML to prevent XSS. Plain text gets wrapped in a paragraph. */
function formatContent(text: string): string {
  if (!text || !text.trim()) return "";
  if (text.trim().startsWith("<") && text.includes(">")) {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "h1", "h2", "h3", "blockquote", "code", "pre", "ul", "ol", "li"],
      ALLOWED_ATTR: ["style"],
    });
  }
  return `<p style="margin:0">${escapeHtml(text)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
