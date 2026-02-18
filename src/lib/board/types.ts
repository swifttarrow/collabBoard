export type BoardObjectType = "sticky" | "rect" | "circle" | "line";

export type LineData = { x2: number; y2: number };

export type BoardObject = {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  text: string;
  /** Shape-specific data. For line: { x2, y2 } = second endpoint. */
  data?: Record<string, unknown>;
};

export type ViewportState = {
  x: number;
  y: number;
  scale: number;
};
