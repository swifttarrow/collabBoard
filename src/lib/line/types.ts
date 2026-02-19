import type { BoardObject } from "@/lib/board/types";
import type { ConnectorEndpoint, RoutingMode } from "./connector-types";

/** Anchor position on a shape perimeter. Maps to spec side+offset. */
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
  /** New connector format: explicit endpoints */
  start?: ConnectorEndpoint;
  end?: ConnectorEndpoint;
  /** Legacy: attached shape ids – backward compat */
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
  /** Routing mode */
  routingMode?: RoutingMode;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
};

export type LineObject = BoardObject & { type: "line"; data?: LineData };

export type LineGeometry = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  points: Array<{ x: number; y: number }>;
};
