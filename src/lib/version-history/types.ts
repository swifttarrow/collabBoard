import type { BoardObject, BoardObjectType } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";

export type HistoryOpType = "create" | "update" | "delete" | "restore";

/** Full state snapshot for restore entries */
export type RestorePayload = Record<string, BoardObjectWithMeta>;

/** Enough data to undo (apply inverse) or redo (re-apply forward). */
export type HistoryEntry = {
  id: string;
  timestamp: number;
  opType: HistoryOpType;
  /** Human-readable description for the history list */
  description: string;
  /** Object id affected (for create/update/delete) */
  objectId: string;
  /** For redo: create=full object, update=partial, delete=id only, restore=full state */
  forwardPayload: CreatePayload | UpdatePayload | DeletePayload | RestorePayload;
  /** For undo: create→delete {id}, update→prev state, delete→full object, restore=prev state */
  inversePayload: CreatePayload | UpdatePayload | DeletePayload | RestorePayload;
};

export type CreatePayload = BoardObjectWithMeta;
export type UpdatePayload = { id: string } & Partial<BoardObject>;
export type DeletePayload = { id: string };

export type HistoryItem = HistoryEntry & {
  /** Index in the main history (for checkpoints/saves) */
  index: number;
  /** Whether this is a save checkpoint */
  isCheckpoint: boolean;
};
