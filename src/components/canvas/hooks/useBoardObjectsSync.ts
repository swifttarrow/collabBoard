"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { rowToObject, objectToRow } from "@/lib/board/sync";
import { performanceMetricsStore } from "@/lib/performance/metrics-store";

const BOARD_OBJECTS_EVENT = "board_objects";

type BroadcastPayload =
  | { op: "INSERT"; object: BoardObjectWithMeta; _sentAt?: number }
  | { op: "UPDATE"; object: BoardObjectWithMeta; _sentAt?: number }
  | { op: "DELETE"; id: string; updated_at: string; _sentAt?: number };

export const REFRESH_OBJECTS_EVENT = "collabboard:refresh-objects";

export function useBoardObjectsSync(boardId: string) {
  const addObject = useBoardStore((s) => s.addObject);
  const updateObject = useBoardStore((s) => s.updateObject);
  const removeObject = useBoardStore((s) => s.removeObject);
  const setBoardId = useBoardStore((s) => s.setBoardId);
  const setObjects = useBoardStore((s) => s.setObjects);
  const applyRemoteObject = useBoardStore((s) => s.applyRemoteObject);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setBoardId(boardId);

    const load = async () => {
      const { data: rows, error } = await supabase
        .from("board_objects")
        .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
        .eq("board_id", boardId)
        .order("updated_at", { ascending: true });

      if (error) {
        console.error("[useBoardObjectsSync] Load error:", error);
        return;
      }

      const objects: Record<string, ReturnType<typeof rowToObject>> = {};
      for (const row of rows ?? []) {
        const obj = rowToObject(row as Parameters<typeof rowToObject>[0]);
        objects[obj.id] = obj;
      }
      setObjects(objects);
    };
    loadRef.current = load;

    const setup = async () => {
      await load();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn("[useBoardObjectsSync] No auth session - Realtime requires auth");
        return;
      }
      await supabase.realtime.setAuth(session.access_token);

      // Use Broadcast instead of postgres_changes to avoid binding mismatch errors.
      // self: false avoids receiving our own broadcasts (reduces flicker on drag).
      const channel = supabase.channel(`board_objects:${boardId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: BOARD_OBJECTS_EVENT }, (payload: { payload: BroadcastPayload }) => {
          const msg = payload.payload;
          if (!msg) return;
          const sentAt = msg._sentAt;
          if (typeof sentAt === "number") {
            performanceMetricsStore.recordObjectSyncLatency(Date.now() - sentAt);
          }
          if (msg.op === "DELETE") {
            applyRemoteObject(msg.id, null, msg.updated_at);
          } else {
            const obj = msg.object;
            if (obj?.board_id !== boardId) return;
            applyRemoteObject(obj.id, obj, obj._updatedAt ?? new Date().toISOString());
          }
        })
        .subscribe((status, err) => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[useBoardObjectsSync] Realtime channel status:", status);
          }
          if (status === "CHANNEL_ERROR") {
            console.error("[useBoardObjectsSync] Realtime channel error:", err?.message);
          }
        });
    };

    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ boardId: string }>).detail;
      if (detail?.boardId === boardId) loadRef.current?.();
    };
    window.addEventListener(REFRESH_OBJECTS_EVENT, onRefresh);

    setup();

    return () => {
      window.removeEventListener(REFRESH_OBJECTS_EVENT, onRefresh);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setBoardId(null);
    };
  }, [boardId, setBoardId, setObjects, applyRemoteObject, supabase]);

  const broadcast = useCallback(
    (payload: BroadcastPayload) => {
      const ch = channelRef.current;
      if (ch) {
        const withTimestamp = {
          ...payload,
          _sentAt: Date.now(),
        };
        void ch.send({ type: "broadcast", event: BOARD_OBJECTS_EVENT, payload: withTimestamp });
      }
    },
    []
  );

  const persistAdd = useCallback(
    async (object: BoardObject) => {
      addObject(object);
      const row = objectToRow(object, boardId);
      const { data: inserted, error } = await supabase
        .from("board_objects")
        .insert(row)
        .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
        .single();
      if (error) {
        console.error("[useBoardObjectsSync] Insert error:", error);
        return;
      }
      const obj = rowToObject(inserted as Parameters<typeof rowToObject>[0]) as BoardObjectWithMeta;
      broadcast({ op: "INSERT", object: { ...obj, board_id: boardId } });
    },
    [boardId, addObject, supabase, broadcast]
  );

  const persistUpdate = useCallback(
    async (id: string, updates: Partial<BoardObject>) => {
      const state = useBoardStore.getState();
      const obj = state.objects[id];
      if (!obj) return;
      const merged = { ...obj, ...updates };
      updateObject(id, updates);
      const { data: updated, error } = await supabase
        .from("board_objects")
        .update({
          parent_id: merged.parentId ?? null,
          x: merged.x,
          y: merged.y,
          width: merged.width,
          height: merged.height,
          rotation: merged.rotation,
          color: merged.color,
          text: merged.text,
          clip_content: merged.clipContent ?? false,
          data: merged.data ?? {},
        })
        .eq("id", id)
        .eq("board_id", boardId)
        .select("updated_at")
        .single();
      if (error) {
        console.error("[useBoardObjectsSync] Update error:", error);
        return;
      }
      const updatedAt = (updated as { updated_at: string })?.updated_at ?? new Date().toISOString();
      const withMeta: BoardObjectWithMeta = { ...merged, _updatedAt: updatedAt, board_id: boardId };
      broadcast({ op: "UPDATE", object: withMeta });
    },
    [boardId, updateObject, supabase, broadcast]
  );

  const persistRemove = useCallback(
    async (id: string) => {
      const state = useBoardStore.getState();
      const obj = state.objects[id];
      removeObject(id);
      const updated_at = new Date().toISOString();
      const { error } = await supabase
        .from("board_objects")
        .delete()
        .eq("id", id)
        .eq("board_id", boardId);
      if (error) {
        console.error("[useBoardObjectsSync] Delete error:", error);
        if (obj) useBoardStore.getState().addObject(obj);
        return;
      }
      broadcast({ op: "DELETE", id, updated_at });
    },
    [boardId, removeObject, supabase, broadcast]
  );

  return {
    addObject: persistAdd,
    updateObject: persistUpdate,
    removeObject: persistRemove,
  };
}
