import type { BoardObject, BoardObjectType } from "./types";
import type { BoardObjectWithMeta } from "./store";

export type BoardObjectRow = {
  id: string;
  board_id: string;
  type: string;
  data: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  text: string | null;
  updated_at: string;
  updated_by: string | null;
};

export function rowToObject(row: BoardObjectRow): BoardObjectWithMeta {
  const obj: BoardObjectWithMeta = {
    id: row.id,
    type: row.type as BoardObjectType,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    color: row.color ?? "#fef08a",
    text: row.text ?? "",
    _updatedAt: row.updated_at,
  };
  return obj;
}

export function objectToRow(object: BoardObject, boardId: string) {
  return {
    id: object.id,
    board_id: boardId,
    type: object.type,
    data: {},
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    color: object.color,
    text: object.text,
  };
}
