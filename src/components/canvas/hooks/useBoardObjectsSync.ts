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
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      } else {
        console.warn("[useBoardObjectsSync] No auth session - Realtime requires auth for RLS");
      }

      channel = supabase
        .channel(`board_objects:${boardId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "board_objects",
            filter: `board_id=eq.${boardId}`,
          },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[useBoardObjectsSync] INSERT received", payload.new);
          }
          const row = payload.new as Parameters<typeof rowToObject>[0];
          const obj = rowToObject(row);
          applyRemoteObject(obj.id, obj, row.updated_at);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
            schema: "public",
            table: "board_objects",
            filter: `board_id=eq.${boardId}`,
          },
          (payload) => {
            const row = payload.new as Parameters<typeof rowToObject>[0];
            const obj = rowToObject(row);
            applyRemoteObject(obj.id, obj, row.updated_at);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "board_objects",
          },
          (payload) => {
            const id = (payload.old as { id: string }).id;
            const updatedAt = (payload.old as { updated_at?: string }).updated_at ?? new Date().toISOString();
            applyRemoteObject(id, null, updatedAt);
          }
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[useBoardObjectsSync] Realtime channel status:", status);
          }
          if (status === "CHANNEL_ERROR") {
            console.error("[useBoardObjectsSync] Realtime channel error - check RLS and publication");
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
