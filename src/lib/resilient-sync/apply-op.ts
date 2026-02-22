/**
 * Resilient Canvas: Apply an op to local state.
 * Used for immediate local apply and when applying remote ops.
 */

import type { BoardObjectType } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type { BoardOperation, CreatePayload, UpdatePayload } from "./operations";

export function applyOpToState(
  op: BoardOperation,
  current: Record<string, BoardObjectWithMeta>
): Record<string, BoardObjectWithMeta> {
  const next = { ...current };

  switch (op.type) {
    case "create": {
      const payload = op.payload as CreatePayload;
      const obj: BoardObjectWithMeta = {
        ...payload,
        _updatedAt: new Date(op.timestamp).toISOString(),
      };
      next[payload.id] = obj;
      break;
    }
    case "update": {
      const payload = op.payload as UpdatePayload;
      const prev = next[payload.id];
      if (!prev) break; // Object may have been deleted (skip per spec)
      const merged: BoardObjectWithMeta = {
        ...prev,
        ...payload,
        id: payload.id,
        type: prev.type,
        _updatedAt: new Date(op.timestamp).toISOString(),
      };
      next[payload.id] = merged;
      break;
    }
    case "delete": {
      const id = (op.payload as { id: string }).id;
      delete next[id];
      break;
    }
  }

  return next;
}

export function createBoardObjectFromRow(row: {
  id: string;
  type: string;
  parent_id?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  text: string | null;
  data?: Record<string, unknown>;
  clip_content?: boolean;
  updated_at: string;
}): BoardObjectWithMeta {
  return {
    id: row.id,
    type: row.type as BoardObjectType,
    parentId: row.parent_id ?? null,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    color: row.color ?? "#fef08a",
    text: row.text ?? "",
    clipContent: row.clip_content ?? false,
    _updatedAt: row.updated_at,
    ...(row.data && Object.keys(row.data).length > 0 ? { data: row.data } : {}),
  };
}
