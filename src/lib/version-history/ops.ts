/**
 * Build history entries and apply inverse/forward ops for undo/redo.
 */
import type { BoardObject, BoardObjectType } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type {
  HistoryEntry,
  HistoryOpType,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  RestorePayload,
} from "./types";

function opDescription(opType: HistoryOpType, objectId: string, type?: string): string {
  switch (opType) {
    case "create":
      return `Create ${type ?? "object"}`;
    case "update":
      return `Update ${type ?? "object"}`;
    case "delete":
      return `Delete ${type ?? "object"}`;
    default:
      return "Unknown";
  }
}

export function createHistoryEntry(
  opType: "create",
  object: BoardObjectWithMeta,
  _prev: null
): HistoryEntry;

export function createHistoryEntry(
  opType: "update",
  updates: Partial<BoardObject> & { id: string },
  prev: BoardObjectWithMeta
): HistoryEntry;

export function createHistoryEntry(
  opType: "delete",
  id: string,
  deletedObject: BoardObjectWithMeta
): HistoryEntry;

export function createHistoryEntry(
  opType: HistoryOpType,
  payload: unknown,
  prevOrDeleted: BoardObjectWithMeta | null
): HistoryEntry {
  const id = crypto.randomUUID();
  const timestamp = Date.now();

  switch (opType) {
    case "create": {
      const obj = payload as BoardObjectWithMeta;
      return {
        id,
        timestamp,
        opType: "create",
        description: opDescription("create", obj.id, obj.type),
        objectId: obj.id,
        forwardPayload: { ...obj },
        inversePayload: { id: obj.id },
      };
    }
    case "update": {
      const updates = payload as UpdatePayload;
      const prev = prevOrDeleted!;
      return {
        id,
        timestamp,
        opType: "update",
        description: opDescription("update", updates.id, prev.type),
        objectId: updates.id,
        forwardPayload: { ...updates } as UpdatePayload,
        inversePayload: {
          id: prev.id,
          parentId: prev.parentId,
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height,
          rotation: prev.rotation,
          color: prev.color,
          text: prev.text,
          clipContent: prev.clipContent,
          data: prev.data,
        } as UpdatePayload,
      };
    }
    case "delete": {
      const deleted = prevOrDeleted!;
      return {
        id,
        timestamp,
        opType: "delete",
        description: opDescription("delete", deleted.id, deleted.type),
        objectId: deleted.id,
        forwardPayload: { id: deleted.id },
        inversePayload: deleted as CreatePayload,
      };
    }
    default:
      throw new Error(`Unknown opType: ${opType}`);
  }
}

/**
 * Apply an entry's forward or inverse payload to the given state.
 * Returns the new objects record.
 */
export function applyEntryToState(
  entry: HistoryEntry,
  direction: "forward" | "inverse",
  current: Record<string, BoardObjectWithMeta>
): Record<string, BoardObjectWithMeta> {
  const payload = direction === "forward" ? entry.forwardPayload : entry.inversePayload;
  const next = { ...current };

  if (entry.opType === "create") {
    if (direction === "forward") {
      const obj = payload as CreatePayload;
      next[obj.id] = { ...obj, _updatedAt: new Date().toISOString() };
    } else {
      delete next[(payload as DeletePayload).id];
    }
  } else if (entry.opType === "update") {
    const p = payload as UpdatePayload;
    const prev = next[p.id];
    if (prev) {
      next[p.id] = {
        ...prev,
        ...p,
        id: p.id,
        type: prev.type as BoardObjectType,
        _updatedAt: new Date().toISOString(),
      };
    }
  } else if (entry.opType === "restore") {
    return direction === "forward"
      ? { ...(payload as RestorePayload) }
      : { ...(entry.inversePayload as RestorePayload) };
  } else {
    // delete
    if (direction === "inverse") {
      const obj = payload as CreatePayload;
      next[obj.id] = { ...obj, _updatedAt: new Date().toISOString() };
    } else {
      delete next[(payload as DeletePayload).id];
    }
  }

  return next;
}

/**
 * Compute state at a given index by replaying past[0..index] from baseState.
 */
export function computeStateAt(
  past: HistoryEntry[],
  upToIndex: number,
  baseState: Record<string, BoardObjectWithMeta> = {}
): Record<string, BoardObjectWithMeta> {
  let state = { ...baseState };
  const end = Math.min(upToIndex + 1, past.length);
  for (let i = 0; i < end; i++) {
    state = applyEntryToState(past[i]!, "forward", state);
  }
  return state;
}

/**
 * Create a restore entry representing "restore board to this state".
 */
export function createRestoreEntry(
  targetState: Record<string, BoardObjectWithMeta>,
  previousState: Record<string, BoardObjectWithMeta>,
  restoredToTimestamp: number
): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    opType: "restore",
    description: `Restore to earlier revision (${new Date(restoredToTimestamp).toLocaleTimeString()})`,
    objectId: "",
    forwardPayload: { ...targetState },
    inversePayload: { ...previousState },
  };
}
