"use client";

import { Rect, Line } from "react-konva";
import type { DraftShape } from "@/components/canvas/hooks/useShapeDraw";
import type { BoxSelectBounds } from "@/components/canvas/hooks/useBoxSelect";
import {
  DRAFT_RECT_FILL,
  DRAFT_RECT_STROKE,
  DRAFT_RECT_DASH,
  DRAFT_CIRCLE_FILL,
  DRAFT_CIRCLE_STROKE,
  DRAFT_CIRCLE_DASH,
  DRAFT_LINE_STROKE,
  DRAFT_LINE_DASH,
  BOX_SELECT_FILL,
  BOX_SELECT_STROKE,
  BOX_SELECT_DASH,
} from "@/components/canvas/constants";

export type DraftShapesLayerProps = {
  /** Draft rect/circle/frame from shape drawing tool */
  shapeDraft: DraftShape | null;
  /** Box select marquee when selecting multiple objects */
  boxSelectDraft: BoxSelectBounds | null;
  /** Draft line from connector-from-handle creation */
  lineCreationDraft:
    | { startX: number; startY: number; endX: number; endY: number }
    | null;
};

export function DraftShapesLayer({
  shapeDraft,
  boxSelectDraft,
  lineCreationDraft,
}: DraftShapesLayerProps) {
  return (
    <>
      {/* Draft rect or frame from shape draw */}
      {(shapeDraft?.type === "rect" || shapeDraft?.type === "frame") && (
        <Rect
          x={shapeDraft.bounds.x}
          y={shapeDraft.bounds.y}
          width={shapeDraft.bounds.width}
          height={shapeDraft.bounds.height}
          fill={DRAFT_RECT_FILL}
          stroke={DRAFT_RECT_STROKE}
          dash={DRAFT_RECT_DASH}
        />
      )}

      {/* Draft circle from shape draw */}
      {shapeDraft?.type === "circle" && (() => {
        const b = shapeDraft.bounds;
        const size = Math.max(Math.abs(b.width), Math.abs(b.height));
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        return (
          <Rect
            x={cx - size / 2}
            y={cy - size / 2}
            width={size}
            height={size}
            cornerRadius={size / 2}
            fill={DRAFT_CIRCLE_FILL}
            stroke={DRAFT_CIRCLE_STROKE}
            dash={DRAFT_CIRCLE_DASH}
          />
        );
      })()}

      {/* Box select marquee */}
      {boxSelectDraft && (
        <Rect
          x={boxSelectDraft.x}
          y={boxSelectDraft.y}
          width={boxSelectDraft.width}
          height={boxSelectDraft.height}
          fill={BOX_SELECT_FILL}
          stroke={BOX_SELECT_STROKE}
          dash={BOX_SELECT_DASH}
          listening={false}
        />
      )}

      {/* Draft line from shape draw tool */}
      {shapeDraft?.type === "line" && (
        <Line
          points={[
            shapeDraft.bounds.x1,
            shapeDraft.bounds.y1,
            shapeDraft.bounds.x2,
            shapeDraft.bounds.y2,
          ]}
          stroke={DRAFT_LINE_STROKE}
          strokeWidth={3}
          lineCap="round"
          dash={DRAFT_LINE_DASH}
        />
      )}

      {/* Draft line from connector handle (drag from anchor) */}
      {lineCreationDraft && (
        <Line
          points={[
            lineCreationDraft.startX,
            lineCreationDraft.startY,
            lineCreationDraft.endX,
            lineCreationDraft.endY,
          ]}
          stroke={DRAFT_LINE_STROKE}
          strokeWidth={3}
          lineCap="round"
          dash={DRAFT_LINE_DASH}
          pointerAtEnd
          pointerLength={10}
          pointerWidth={8}
        />
      )}
    </>
  );
}
