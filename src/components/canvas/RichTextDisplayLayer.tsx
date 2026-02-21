"use client";

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
  SELECTION_STROKE_WIDTH,
} from "./constants";

type RichTextDisplayLayerProps = {
  objects: Record<string, BoardObjectWithMeta>;
  selection: string[];
  viewport: { x: number; y: number; scale: number };
  stageWidth: number;
  stageHeight: number;
  /** Id of object being edited - hide its display when editing */
  editingId: string | null;
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
}: RichTextDisplayLayerProps) {
  const { x: vx, y: vy, scale } = viewport;
  const worldMargin = CULL_MARGIN_SCREEN_PX / Math.max(scale, 0.01);
  const viewportWorld = {
    minX: (-vx) / scale - worldMargin,
    minY: (-vy) / scale - worldMargin,
    maxX: (stageWidth - vx) / scale + worldMargin,
    maxY: (stageHeight - vy) / scale + worldMargin,
  };

  const textObjects = getStickyTextInRenderOrder(objects, selection).filter(
    (o) => o.id !== editingId
  );

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10"
      style={{ width: stageWidth, height: stageHeight }}
      aria-hidden
    >
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

        return (
          <div
            key={obj.id}
            className="overflow-hidden overflow-y-auto break-words [&_p]:m-0 [&_p]:leading-relaxed [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-bold [&_h2]:text-base [&_h3]:font-semibold [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-0.5 [&_code]:font-mono [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            style={{
              zIndex: index,
              position: "absolute",
              left: Math.round(left),
              top: Math.round(top),
              width: Math.round(width),
              height: Math.round(height),
              transform: (obj.rotation ?? 0) !== 0 ? `rotate(${obj.rotation}deg)` : undefined,
              transformOrigin: "0 0",
              padding: STICKY_TEXT_PADDING * scale,
              boxSizing: "border-box",
              fontSize: STICKY_FONT_SIZE * scale,
              color: STICKY_TEXT_FILL,
              borderRadius: isSticky ? STICKY_CORNER_RADIUS * scale : 4,
              // Render sticky background in HTML so stacking matches shapes (overlay order)
              ...(isSticky && {
                display: "flex",
                alignItems: "flex-start",
                backgroundColor: obj.color ?? DEFAULT_STICKY_COLOR,
                boxShadow: `0 2px ${STICKY_SHADOW.blur}px rgba(0,0,0,${STICKY_SHADOW.opacity})`,
                ...(isSelected && {
                  outline: `${SELECTION_STROKE_WIDTH}px solid ${getSelectionStroke(obj.color ?? DEFAULT_STICKY_COLOR)}`,
                  outlineOffset: -SELECTION_STROKE_WIDTH,
                }),
              }),
            }}
            dangerouslySetInnerHTML={{ __html: formatContent(obj.text ?? "") }}
          />
        );
      })}
    </div>
  );
}

/** Ensure content is valid HTML. Plain text gets wrapped in a paragraph. */
function formatContent(text: string): string {
  if (!text || !text.trim()) return "";
  if (text.trim().startsWith("<") && text.includes(">")) {
    return text;
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
