import type { BoardObject } from "@/lib/board/types";

/** Anchor position on a shape perimeter. For rect/sticky: edge + optional mid. */
export type AnchorKind =
  | "top"
  | "top-mid"
  | "right"
  | "right-mid"
  | "bottom"
  | "bottom-mid"
  | "left"
  | "left-mid";

export type LineCap = "arrow" | "point";

export type LineData = {
  /** Legacy: attached shape ids – kept for backward compat with existing boards */
  startShapeId?: string;
  endShapeId?: string;
  startAnchor?: AnchorKind;
  endAnchor?: AnchorKind;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  /** Free end coords (object.x, object.y = start) */
  x2?: number;
  y2?: number;
  /** Endpoint cap style */
  startCap?: LineCap;
  endCap?: LineCap;
};

export type LineObject = BoardObject & { type: "line"; data?: LineData };

export type LineGeometry = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  points: Array<{ x: number; y: number }>;
};
