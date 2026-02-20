/**
 * Resilient Canvas: Operation types for local-first sync.
 * Every mutation is an idempotent op with opId, clientId, boardId, baseRevision, etc.
 */

import type { BoardObject } from "@/lib/board/types";

export type OpType = "create" | "update" | "delete";

export type BoardOperation = {
  opId: string;
  clientId: string;
  boardId: string;
  timestamp: number;
  baseRevision: number;
  type: OpType;
  payload: CreatePayload | UpdatePayload | DeletePayload;
  idempotencyKey: string;
};

export type CreatePayload = BoardObject;

export type UpdatePayload = {
  id: string;
} & Partial<
  Pick<
    BoardObject,
    | "parentId"
    | "x"
    | "y"
    | "width"
    | "height"
    | "rotation"
    | "color"
    | "text"
    | "clipContent"
    | "data"
  >
>;

export type DeletePayload = { id: string };

export type PendingOp = BoardOperation & {
  createdAt: number;
  status: "pending" | "acking" | "acked" | "failed";
  failureReason?: string;
};

export function createOp(
  type: OpType,
  payload: CreatePayload | UpdatePayload | DeletePayload,
  boardId: string,
  clientId: string,
  baseRevision: number
): BoardOperation {
  const opId = crypto.randomUUID();
  return {
    opId,
    clientId,
    boardId,
    timestamp: Date.now(),
    baseRevision,
    type,
    payload,
    idempotencyKey: opId,
  };
}
