export type BoardObjectType = "sticky" | "rect" | "circle" | "line" | "frame" | "text";

export type LineData = { x2: number; y2: number };

export type BoardObject = {
  id: string;
  type: BoardObjectType;
  /** Parent frame id; null = board root. Local coords (x,y) relative to parent. */
  parentId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  text: string;
  /** Shape-specific data. For line: { x2, y2 } = second endpoint. */
  data?: Record<string, unknown>;
  /** For frames: clip children to bounds. Default true. */
  clipContent?: boolean;
};

export type ViewportState = {
  x: number;
  y: number;
  scale: number;
};
