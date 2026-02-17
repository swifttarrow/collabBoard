export type BoardObjectType = "sticky" | "rect";

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
};

export type ViewportState = {
  x: number;
  y: number;
  scale: number;
};
