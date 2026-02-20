"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { rowToObject, objectToRow } from "@/lib/board/sync";
import { performanceMetricsStore } from "@/lib/performance/metrics-store";
import {
  createOp,
  type PendingOp,
  type CreatePayload,
  type UpdatePayload,
} from "@/lib/resilient-sync/operations";
import { applyOpToState } from "@/lib/resilient-sync/apply-op";
import {
  outboxEnqueue,
  outboxGetPending,
  outboxClearPending,
  outboxMarkAcked,
  outboxMarkFailed,
  outboxCount,
  snapshotPut,
  snapshotGet,
} from "@/lib/resilient-sync/outbox-db";
import {
  useSyncStore,
  computeConnectivityState,
  createConnectivityInput,
} from "@/lib/resilient-sync";

const BOARD_OBJECTS_EVENT = "board_objects";
const OUTBOX_WARN_THRESHOLD = 500;
const OUTBOX_CRITICAL_LIMIT = 5000;

type BroadcastPayload =
  | { op: "INSERT"; object: BoardObjectWithMeta; _sentAt?: number }
  | { op: "UPDATE"; object: BoardObjectWithMeta; _sentAt?: number }
  | { op: "DELETE"; id: string; updated_at: string; _sentAt?: number };

import {
  FRAME_TO_CONTENT_EVENT,
  setSuppressNextFrameToContent,
} from "./useFrameToContent";
import { animatePan, animateZoomBy } from "@/lib/viewport/tools";
import type {
  ViewportCommandPayload,
  FindResultPayload,
} from "@/lib/ai/tools/types";

export const REFRESH_OBJECTS_EVENT = "collabboard:refresh-objects";

type UseBoardObjectsSyncOptions = {
  onFindZoom?: (objectId: string) => void;
  onInitialLoad?: (objects: Record<string, BoardObjectWithMeta>) => void;
  onRecordOp?: (
    opType: "create" | "update" | "delete",
    payload: unknown,
    prevOrDeleted: BoardObjectWithMeta | null
  ) => void;
};

export function useBoardObjectsSync(
  boardId: string,
  options?: UseBoardObjectsSyncOptions
) {
  const { onFindZoom, onInitialLoad, onRecordOp } = options ?? {};
  const onFindZoomRef = useRef(onFindZoom);
  onFindZoomRef.current = onFindZoom;
  const onInitialLoadRef = useRef(onInitialLoad);
  onInitialLoadRef.current = onInitialLoad;

  const addObjectStore = useBoardStore((s) => s.addObject);
  const updateObjectStore = useBoardStore((s) => s.updateObject);
  const removeObjectStore = useBoardStore((s) => s.removeObject);
  const setBoardId = useBoardStore((s) => s.setBoardId);
  const setObjects = useBoardStore((s) => s.setObjects);
  const applyRemoteObject = useBoardStore((s) => s.applyRemoteObject);
  const channelRef =
    useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const serverRevisionRef = useRef(0);
  const realtimeConnectedRef = useRef(false);
  const realtimeDisconnectedSinceRef = useRef<number | null>(null);
  const recentErrorsRef = useRef(0);
  const recentErrorsWindowStartRef = useRef(0);
  const clientIdRef = useRef<string>("anonymous");

  const setConnectivityState = useSyncStore((s) => s.setConnectivityState);
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const setFailedCount = useSyncStore((s) => s.setFailedCount);
  const setServerRevision = useSyncStore((s) => s.setServerRevision);
  const setLastSyncMessage = useSyncStore((s) => s.setLastSyncMessage);
  const setRecoveringFromOffline = useSyncStore((s) => s.setRecoveringFromOffline);

  const updateConnectivity = useCallback(() => {
    outboxCount(boardId).then(({ pending, failed }) => {
      setPendingCount(pending);
      setFailedCount(failed);
      const state = computeConnectivityState({
        ...createConnectivityInput(),
        navigatorOnLine: typeof navigator !== "undefined" ? navigator.onLine : true,
        realtimeConnected: realtimeConnectedRef.current,
        realtimeDisconnectedSince: realtimeDisconnectedSinceRef.current,
        pendingCount: pending,
        recentErrors: recentErrorsRef.current,
        recentErrorsWindowStart: recentErrorsWindowStartRef.current,
      });
      setConnectivityState(state);
      if (state === "ONLINE_SYNCED" && pending === 0) {
        setRecoveringFromOffline(false);
      }
    });
  }, [boardId, setConnectivityState, setPendingCount, setFailedCount, setRecoveringFromOffline]);

  const broadcast = useCallback((payload: BroadcastPayload) => {
    const ch = channelRef.current;
    if (ch) {
      void ch.send({
        type: "broadcast",
        event: BOARD_OBJECTS_EVENT,
        payload: { ...payload, _sentAt: Date.now() },
      });
    }
  }, []);

  const sendOp = useCallback(
    async (op: PendingOp): Promise<{ ok: boolean; revision?: number }> => {
      try {
        const res = await fetch(`/api/boards/${boardId}/ops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: {
              opId: op.opId,
              clientId: op.clientId,
              boardId: op.boardId,
              timestamp: op.timestamp,
              baseRevision: op.baseRevision,
              type: op.type,
              payload: op.payload,
              idempotencyKey: op.idempotencyKey,
            },
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            await outboxMarkFailed(op.opId, "Unauthorized");
          } else if (res.status >= 400 && res.status < 500) {
            await outboxMarkFailed(op.opId, data.error || "Rejected");
          } else {
            recentErrorsRef.current += 1;
            recentErrorsWindowStartRef.current = Date.now();
            return { ok: false };
          }
          updateConnectivity();
          return { ok: false };
        }

        const revision = data.revision ?? serverRevisionRef.current;
        serverRevisionRef.current = revision;
        setServerRevision(revision);
        await outboxMarkAcked(op.opId);

        if (op.type === "create") {
          const obj = op.payload as CreatePayload;
          const withMeta: BoardObjectWithMeta = {
            ...obj,
            _updatedAt: new Date().toISOString(),
            board_id: boardId,
          };
          broadcast({ op: "INSERT", object: withMeta });
        } else if (op.type === "update") {
          const state = useBoardStore.getState();
          const merged = state.objects[(op.payload as UpdatePayload).id];
          if (merged) {
            broadcast({
              op: "UPDATE",
              object: { ...merged, board_id: boardId },
            });
          }
        } else {
          broadcast({
            op: "DELETE",
            id: (op.payload as { id: string }).id,
            updated_at: new Date().toISOString(),
          });
        }

        performanceMetricsStore.recordObjectSyncLatency(0);
        updateConnectivity();
        return { ok: true, revision };
      } catch (err) {
        recentErrorsRef.current += 1;
        recentErrorsWindowStartRef.current = Date.now();
        if (process.env.NODE_ENV === "development") {
          console.debug("[useBoardObjectsSync] Send error:", err);
        }
        updateConnectivity();
        return { ok: false };
      }
    },
    [boardId, broadcast, setServerRevision, updateConnectivity]
  );

  const drainOutbox = useCallback(async () => {
    const pending = await outboxGetPending(boardId);
    if (pending.length === 0) return;

    if (pending.length >= OUTBOX_CRITICAL_LIMIT) {
      setLastSyncMessage("Too many pending changes. Please refresh or save locally.");
      return;
    }

    if (pending.length >= OUTBOX_WARN_THRESHOLD) {
      setLastSyncMessage(`${pending.length} changes pending. Consider refreshing.`);
    }

    const countBefore = pending.length;
    for (const op of pending) {
      const { ok } = await sendOp(op);
      if (!ok && op.status !== "failed") break;
    }

    const remaining = await outboxGetPending(boardId);
    if (countBefore > 0 && remaining.length === 0) {
      setLastSyncMessage("All changes synced.");
      try {
        const res = await fetch(`/api/boards/${boardId}/snapshot`);
        if (res.ok) {
          const { objects, revision } = await res.json();
          setObjects(objects ?? {});
          serverRevisionRef.current = revision ?? 0;
          setServerRevision(revision ?? 0);
          await snapshotPut({
            boardId,
            objects: objects ?? {},
            serverRevision: revision ?? 0,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Ignore fetch error
      }
    }
  }, [boardId, sendOp, setObjects, setServerRevision]);

  useEffect(() => {
    setBoardId(boardId);

    let sendIntervalId: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      clientIdRef.current = userId ?? "anonymous";

      if (!userId || !session?.access_token) {
        setConnectivityState("OFFLINE");
        return;
      }

      let baseObjects: Record<string, BoardObjectWithMeta> = {};
      const cached = await snapshotGet(boardId);
      if (cached?.objects) {
        baseObjects = cached.objects;
        serverRevisionRef.current = cached.serverRevision;
        setObjects(baseObjects);
      }

      try {
        const res = await fetch(`/api/boards/${boardId}/snapshot`);
        if (res.ok && mounted) {
          const { objects, revision } = await res.json();
          baseObjects = objects ?? {};
          serverRevisionRef.current = revision ?? 0;
          setServerRevision(revision ?? 0);
        }
      } catch {
        // Offline or network error - keep cached/empty base
      }

      const pending = await outboxGetPending(boardId);
      let initialObjects: Record<string, BoardObjectWithMeta>;
      if (pending.length > 0) {
        let rebased = { ...baseObjects };
        for (const op of pending) {
          rebased = applyOpToState(op, rebased);
        }
        initialObjects = rebased;
        setObjects(rebased);
      } else {
        initialObjects = baseObjects;
        setObjects(baseObjects);
        await snapshotPut({
          boardId,
          objects: baseObjects,
          serverRevision: serverRevisionRef.current,
          timestamp: Date.now(),
        });
      }

      onInitialLoadRef.current?.(initialObjects);

      await supabase.realtime.setAuth(session.access_token);

      const channel = supabase.channel(`board_objects:${boardId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on(
          "broadcast",
          { event: "viewport_command" },
          ({ payload }: { payload: ViewportCommandPayload }) => {
            if (!payload) return;
            if (payload.action === "pan") animatePan(payload.deltaX, payload.deltaY);
            else if (payload.action === "zoomBy")
              animateZoomBy(
                payload.factor,
                typeof window !== "undefined" ? window.innerWidth : 1200,
                typeof window !== "undefined" ? window.innerHeight : 800
              );
            else if (payload.action === "frameToContent")
              window.dispatchEvent(
                new CustomEvent(FRAME_TO_CONTENT_EVENT, { detail: { boardId } })
              );
          }
        )
        .on(
          "broadcast",
          { event: "find_result" },
          ({ payload }: { payload: FindResultPayload }) => {
            if (!payload || payload.action !== "selectAndZoom") return;
            setSuppressNextFrameToContent();
            useBoardStore.getState().setSelection([payload.objectId]);
            onFindZoomRef.current?.(payload.objectId);
          }
        )
        .on(
          "broadcast",
          { event: BOARD_OBJECTS_EVENT },
          (payload: { payload: BroadcastPayload }) => {
            const msg = payload.payload;
            if (!msg) return;
            const sentAt = msg._sentAt;
            if (typeof sentAt === "number")
              performanceMetricsStore.recordObjectSyncLatency(Date.now() - sentAt);
            if (msg.op === "DELETE") {
              applyRemoteObject(msg.id, null, msg.updated_at);
            } else {
              const obj = msg.object;
              if (obj?.board_id !== boardId) return;
              applyRemoteObject(obj.id, obj, obj._updatedAt ?? new Date().toISOString());
            }
          }
        )
        .subscribe((status) => {
          realtimeConnectedRef.current = status === "SUBSCRIBED";
          if (status === "SUBSCRIBED") {
            realtimeDisconnectedSinceRef.current = null;
            setLastSyncMessage(null);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            realtimeDisconnectedSinceRef.current = Date.now();
          }
          updateConnectivity();
        });

      sendIntervalId = setInterval(() => {
        if (navigator.onLine && realtimeConnectedRef.current) {
          drainOutbox();
        }
        updateConnectivity();
      }, 2000);
    };

    setup();

    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ boardId: string; frameToContent?: boolean }>).detail;
      if (detail?.boardId !== boardId) return;
      void fetch(`/api/boards/${boardId}/snapshot`)
        .then((r) => r.json())
        .then(({ objects, revision }) => {
          setObjects(objects ?? {});
          serverRevisionRef.current = revision ?? 0;
          if (detail?.frameToContent)
            window.dispatchEvent(
              new CustomEvent(FRAME_TO_CONTENT_EVENT, { detail: { boardId } })
            );
        });
    };
    window.addEventListener(REFRESH_OBJECTS_EVENT, onRefresh);

    const onOnline = () => {
      setRecoveringFromOffline(true);
      setLastSyncMessage("Reconnected. Syncing changes…");
      drainOutbox();
      updateConnectivity();
    };
    window.addEventListener("online", onOnline);

    return () => {
      mounted = false;
      window.removeEventListener(REFRESH_OBJECTS_EVENT, onRefresh);
      window.removeEventListener("online", onOnline);
      if (sendIntervalId) clearInterval(sendIntervalId);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setBoardId(null);
    };
  }, [
    boardId,
    setBoardId,
    setObjects,
    applyRemoteObject,
    supabase,
    setConnectivityState,
    setServerRevision,
    setLastSyncMessage,
    updateConnectivity,
    drainOutbox,
  ]);

  const persistAdd = useCallback(
    (object: BoardObject) => {
      addObjectStore(object);
      onRecordOp?.("create", object, null);
      const cid = clientIdRef.current;
      const baseRev = serverRevisionRef.current;
      const op = createOp("create", object as CreatePayload, boardId, cid, baseRev);
      const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
      outboxEnqueue(pending).then(updateConnectivity);
    },
    [boardId, addObjectStore, updateConnectivity, onRecordOp]
  );

  const persistUpdate = useCallback(
    (id: string, updates: Partial<BoardObject>) => {
      const state = useBoardStore.getState();
      const obj = state.objects[id];
      if (!obj) return;
      updateObjectStore(id, updates);
      onRecordOp?.("update", { id, ...updates }, obj);
      const cid = clientIdRef.current;
      const baseRev = serverRevisionRef.current;
      const payload: UpdatePayload = { id, ...updates };
      const op = createOp("update", payload, boardId, cid, baseRev);
      const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
      outboxEnqueue(pending).then(updateConnectivity);
    },
    [boardId, updateObjectStore, updateConnectivity, onRecordOp]
  );

  const persistRemove = useCallback(
    (id: string) => {
      const state = useBoardStore.getState();
      const obj = state.objects[id];
      removeObjectStore(id);
      onRecordOp?.("delete", id, obj ?? null);
      const cid = clientIdRef.current;
      const baseRev = serverRevisionRef.current;
      const op = createOp("delete", { id }, boardId, cid, baseRev);
      const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
      outboxEnqueue(pending).then(updateConnectivity);
    },
    [boardId, removeObjectStore, updateConnectivity, onRecordOp]
  );

  const restoreToState = useCallback(
    async (targetState: Record<string, BoardObjectWithMeta>) => {
      try {
        const res = await fetch(`/api/boards/${boardId}/snapshot`);
        if (!res.ok) return;
        const { objects: serverObjects } = await res.json();
        const server = (serverObjects ?? {}) as Record<string, BoardObjectWithMeta>;

        const serverIds = new Set(Object.keys(server));
        const targetIds = new Set(Object.keys(targetState));

        const toDelete = [...serverIds].filter((id) => !targetIds.has(id));
        const toCreate = [...targetIds].filter((id) => !serverIds.has(id));
        const toUpdate = [...targetIds].filter((id) => {
          if (!serverIds.has(id)) return false;
          const a = server[id]!;
          const b = targetState[id]!;
          return (
            a.x !== b.x ||
            a.y !== b.y ||
            a.width !== b.width ||
            a.height !== b.height ||
            a.rotation !== b.rotation ||
            a.color !== b.color ||
            a.text !== b.text ||
            a.parentId !== b.parentId ||
            JSON.stringify(a.data ?? {}) !== JSON.stringify(b.data ?? {}) ||
            a.clipContent !== b.clipContent
          );
        });

        const cid = clientIdRef.current;
        let baseRev = serverRevisionRef.current;

        await outboxClearPending(boardId);
        updateConnectivity();

        const remaining = new Set(toDelete);
        const sortedDeletes: string[] = [];
        while (remaining.size > 0) {
          const ready = [...remaining].filter((id) => {
            const obj = server[id];
            return !obj?.parentId || !remaining.has(obj.parentId);
          });
          if (ready.length === 0) break;
          sortedDeletes.push(...ready);
          ready.forEach((id) => remaining.delete(id));
        }
        sortedDeletes.push(...remaining);

        for (const id of sortedDeletes) {
          const op = createOp("delete", { id }, boardId, cid, baseRev);
          const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
          await outboxEnqueue(pending);
          baseRev += 1;
        }

        const createOrder = [...toCreate].sort((a, b) => {
          const aParent = targetState[a]?.parentId;
          const bParent = targetState[b]?.parentId;
          const aParentFirst = !aParent || !toCreate.includes(aParent);
          const bParentFirst = !bParent || !toCreate.includes(bParent);
          if (aParentFirst && !bParentFirst) return -1;
          if (!aParentFirst && bParentFirst) return 1;
          if (aParent && bParent && aParent === bParent) return 0;
          if (aParent === b) return 1;
          if (bParent === a) return -1;
          return 0;
        });

        for (const id of createOrder) {
          const obj = targetState[id]!;
          const payload: CreatePayload = {
            id: obj.id,
            type: obj.type,
            parentId: obj.parentId ?? null,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            rotation: obj.rotation ?? 0,
            color: obj.color ?? "#fef08a",
            text: obj.text ?? "",
            clipContent: obj.clipContent ?? false,
            data: obj.data ?? {},
          };
          const op = createOp("create", payload, boardId, cid, baseRev);
          const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
          await outboxEnqueue(pending);
          baseRev += 1;
        }

        for (const id of toUpdate) {
          const prev = server[id]!;
          const next = targetState[id]!;
          const updates: UpdatePayload = { id };
          if (prev.x !== next.x) updates.x = next.x;
          if (prev.y !== next.y) updates.y = next.y;
          if (prev.width !== next.width) updates.width = next.width;
          if (prev.height !== next.height) updates.height = next.height;
          if (prev.rotation !== next.rotation) updates.rotation = next.rotation ?? 0;
          if (prev.color !== next.color) updates.color = next.color ?? "#fef08a";
          if (prev.text !== next.text) updates.text = next.text ?? "";
          if (prev.parentId !== next.parentId) updates.parentId = next.parentId ?? null;
          if (prev.clipContent !== next.clipContent) updates.clipContent = next.clipContent ?? false;
          if (JSON.stringify(prev.data ?? {}) !== JSON.stringify(next.data ?? {}))
            updates.data = next.data ?? {};
          const op = createOp("update", updates, boardId, cid, baseRev);
          const pending: PendingOp = { ...op, createdAt: Date.now(), status: "pending" };
          await outboxEnqueue(pending);
          baseRev += 1;
        }

        updateConnectivity();
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[useBoardObjectsSync] Restore persist failed:", err);
        }
      }
    },
    [boardId, updateConnectivity]
  );

  return {
    addObject: persistAdd,
    updateObject: persistUpdate,
    removeObject: persistRemove,
    restoreToState,
  };
}
