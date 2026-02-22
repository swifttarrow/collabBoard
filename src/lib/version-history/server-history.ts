/**
 * Server-side history: convert DB payloads to client format and replay for restore.
 */
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type { BoardObjectType } from "@/lib/board/types";

export type ServerHistoryEntry = {
  id: string;
  serverRevision: number;
  opType: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  userId: string | null;
  userName: string;
  createdAt: string;
};

function dbPayloadToClient(
  opType: "create" | "update" | "delete",
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (opType === "delete") {
    return payload;
  }
  const p = payload as Record<string, unknown>;
  const client: Record<string, unknown> = {
    id: p.id,
  };
  if (opType === "create") {
    client.type = p.type;
    client.parentId = p.parent_id ?? null;
    client.x = p.x ?? 0;
    client.y = p.y ?? 0;
    client.width = p.width ?? 0;
    client.height = p.height ?? 0;
    client.rotation = p.rotation ?? 0;
    client.color = p.color ?? "#fef08a";
    client.text = p.text ?? "";
    client.clipContent = p.clip_content ?? false;
    client.data = p.data ?? {};
  } else {
    if (p.parent_id !== undefined) client.parentId = p.parent_id;
    if (p.x !== undefined) client.x = p.x;
    if (p.y !== undefined) client.y = p.y;
    if (p.width !== undefined) client.width = p.width;
    if (p.height !== undefined) client.height = p.height;
    if (p.rotation !== undefined) client.rotation = p.rotation;
    if (p.color !== undefined) client.color = p.color;
    if (p.text !== undefined) client.text = p.text;
    if (p.clip_content !== undefined) client.clipContent = p.clip_content;
    if (p.data !== undefined) client.data = p.data;
  }
  return client;
}

function applyHistoryOp(
  opType: "create" | "update" | "delete",
  payload: Record<string, unknown>,
  timestamp: string,
  current: Record<string, BoardObjectWithMeta>
): Record<string, BoardObjectWithMeta> {
  const next = { ...current };
  const p = dbPayloadToClient(opType, payload) as Record<string, unknown>;

  if (opType === "create") {
    const obj: BoardObjectWithMeta = {
      id: p.id as string,
      type: p.type as BoardObjectType,
      parentId: (p.parentId as string | null) ?? null,
      x: (p.x as number) ?? 0,
      y: (p.y as number) ?? 0,
      width: (p.width as number) ?? 0,
      height: (p.height as number) ?? 0,
      rotation: (p.rotation as number) ?? 0,
      color: (p.color as string) ?? "#fef08a",
      text: (p.text as string) ?? "",
      clipContent: (p.clipContent as boolean) ?? false,
      data: (p.data as Record<string, unknown>) ?? {},
      _updatedAt: timestamp,
    };
    next[obj.id] = obj;
  } else if (opType === "update") {
    const id = p.id as string;
    const prev = next[id];
    if (prev) {
      const merged: BoardObjectWithMeta = {
        ...prev,
        ...p,
        id,
        type: prev.type,
        _updatedAt: timestamp,
      };
      next[id] = merged;
    }
  } else {
    const id = (p.id as string) ?? (payload.id as string);
    delete next[id];
  }
  return next;
}

/**
 * Compute board state at a given revision by replaying history entries.
 */
export function computeStateAtRevision(
  entries: ServerHistoryEntry[],
  upToRevision: number
): Record<string, BoardObjectWithMeta> {
  let state: Record<string, BoardObjectWithMeta> = {};
  for (const entry of entries) {
    if (entry.serverRevision > upToRevision) break;
    state = applyHistoryOp(
      entry.opType,
      entry.payload,
      entry.createdAt,
      state
    );
  }
  return state;
}

/**
 * Group history entries into time-based milestones.
 * Each milestone covers a time window and can be expanded to show ops.
 */
export type HistoryMilestone = {
  id: string;
  label: string;
  startRevision: number;
  endRevision: number;
  entries: ServerHistoryEntry[];
  startTime: number;
  endTime: number;
};

const MS_MINUTE = 60_000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

function formatMilestoneLabel(entries: ServerHistoryEntry[]): string {
  if (entries.length === 0) return "No changes";
  const first = entries[0]!;
  const start = new Date(first.createdAt);
  const count = entries.length;
  const now = Date.now();
  const startMs = start.getTime();
  const diff = now - startMs;

  let timeLabel: string;
  if (diff < MS_MINUTE) timeLabel = "Just now";
  else if (diff < MS_HOUR) timeLabel = `${Math.floor(diff / MS_MINUTE)}m ago`;
  else if (diff < MS_DAY) timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  else if (diff < 2 * MS_DAY) timeLabel = "Yesterday";
  else if (diff < 7 * MS_DAY) timeLabel = start.toLocaleDateString(undefined, { weekday: "short" });
  else timeLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return `${timeLabel} · ${count} change${count === 1 ? "" : "s"}`;
}

export function groupIntoMilestones(
  entries: ServerHistoryEntry[],
  windowMs: number = 15 * MS_MINUTE
): HistoryMilestone[] {
  if (entries.length === 0) return [];

  const milestones: HistoryMilestone[] = [];
  let currentGroup: ServerHistoryEntry[] = [];
  let groupStartRevision = 0;
  let groupStartTime = 0;

  for (const entry of entries) {
    const entryTime = new Date(entry.createdAt).getTime();
    const firstInGroup = currentGroup[0];
    const firstTime = firstInGroup ? new Date(firstInGroup.createdAt).getTime() : 0;

    if (
      currentGroup.length === 0 ||
      entryTime - firstTime <= windowMs
    ) {
      if (currentGroup.length === 0) {
        groupStartRevision = entry.serverRevision;
        groupStartTime = entryTime;
      }
      currentGroup.push(entry);
    } else {
      milestones.push({
        id: `m-${groupStartRevision}`,
        label: formatMilestoneLabel(currentGroup),
        startRevision: groupStartRevision,
        endRevision: currentGroup[currentGroup.length - 1]!.serverRevision,
        entries: [...currentGroup],
        startTime: groupStartTime,
        endTime: new Date(currentGroup[currentGroup.length - 1]!.createdAt).getTime(),
      });
      currentGroup = [entry];
      groupStartRevision = entry.serverRevision;
      groupStartTime = entryTime;
    }
  }

  if (currentGroup.length > 0) {
    milestones.push({
      id: `m-${groupStartRevision}`,
      label: formatMilestoneLabel(currentGroup),
      startRevision: groupStartRevision,
      endRevision: currentGroup[currentGroup.length - 1]!.serverRevision,
      entries: [...currentGroup],
      startTime: groupStartTime,
      endTime: new Date(currentGroup[currentGroup.length - 1]!.createdAt).getTime(),
    });
  }

  return milestones.reverse();
}

export function opDescription(
  opType: "create" | "update" | "delete",
  payload: Record<string, unknown>
): string {
  const type = (payload.type as string) ?? "object";
  switch (opType) {
    case "create":
      return `Create ${type}`;
    case "update":
      return `Update ${type}`;
    case "delete":
      return "Delete object";
    default:
      return "Unknown";
  }
}
