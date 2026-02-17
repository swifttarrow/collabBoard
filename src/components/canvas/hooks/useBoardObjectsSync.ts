"use client";

import { useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObject } from "@/lib/board/types";
import { rowToObject, objectToRow } from "@/lib/board/sync";

export function useBoardObjectsSync(boardId: string | null) {
  const addObject = useBoardStore((s) => s.addObject);
  const updateObject = useBoardStore((s) => s.updateObject);
  const removeObject = useBoardStore((s) => s.removeObject);
  const setBoardId = useBoardStore((s) => s.setBoardId);
  const setObjects = useBoardStore((s) => s.setObjects);
  const applyRemoteObject = useBoardStore((s) => s.applyRemoteObject);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!boardId) return;

    setBoardId(boardId);

    const load = async () => {
      const { data: rows, error } = await supabase
        .from("board_objects")
        .select("id, board_id, type, data, x, y, width, height, rotation, color, text, updated_at, updated_by")
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

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      await load();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn("[useBoardObjectsSync] No auth session - Realtime requires auth for RLS");
        return;
      }
      await supabase.realtime.setAuth(session.access_token);

      // Must include filter: "" when no filter - server echoes it back and isFilterValueEqual
      // compares strictly; undefined vs "" causes "mismatch between server and client bindings"
      channel = supabase
        .channel(`board_objects:${boardId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "board_objects",
            filter: "",
          },
          (payload: {
            eventType: "INSERT" | "UPDATE" | "DELETE";
            new: Parameters<typeof rowToObject>[0] & { board_id?: string };
            old: { id?: string; board_id?: string; updated_at?: string };
          }) => {
            const rowBoardId = payload.new?.board_id ?? payload.old?.board_id;
            if (rowBoardId !== boardId) return;

            const eventType = payload.eventType;
            if (eventType === "DELETE") {
              const id = payload.old?.id;
              if (id) {
                const updatedAt = payload.old?.updated_at ?? new Date().toISOString();
                applyRemoteObject(id, null, updatedAt);
              }
            } else {
              const row = payload.new;
              if (row) {
                const obj = rowToObject(row);
                applyRemoteObject(obj.id, obj, row.updated_at);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[useBoardObjectsSync] Realtime channel status:", status);
          }
          if (status === "CHANNEL_ERROR") {
            console.error(
              "[useBoardObjectsSync] Realtime channel error:",
              err?.message ?? "check RLS and publication"
            );
          }
        });
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
      setBoardId(null);
    };
  }, [boardId, setBoardId, setObjects, applyRemoteObject, supabase]);

  const persistAdd = useCallback(
    async (object: BoardObject) => {
      addObject(object);
      const row = objectToRow(object, boardId!);
      const { error } = await supabase.from("board_objects").insert(row);
      if (error) console.error("[useBoardObjectsSync] Insert error:", error);
    },
    [boardId, addObject, supabase]
  );

  const persistUpdate = useCallback(
    async (id: string, updates: Partial<BoardObject>) => {
      const state = useBoardStore.getState();
      const obj = state.objects[id];
      if (!obj) return;
      const merged = { ...obj, ...updates };
      updateObject(id, updates);
      const { error } = await supabase
        .from("board_objects")
        .update({
          x: merged.x,
          y: merged.y,
          width: merged.width,
          height: merged.height,
          rotation: merged.rotation,
          color: merged.color,
          text: merged.text,
        })
        .eq("id", id)
        .eq("board_id", boardId!);
      if (error) console.error("[useBoardObjectsSync] Update error:", error);
    },
    [boardId, updateObject, supabase]
  );

  const persistRemove = useCallback(
    async (id: string) => {
      removeObject(id);
      const { error } = await supabase
        .from("board_objects")
        .delete()
        .eq("id", id)
        .eq("board_id", boardId!);
      if (error) console.error("[useBoardObjectsSync] Delete error:", error);
    },
    [boardId, removeObject, supabase]
  );

  return {
    addObject: persistAdd,
    updateObject: persistUpdate,
    removeObject: persistRemove,
  };
}
