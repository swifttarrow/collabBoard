import { create } from "zustand";
import type { BoardObject, ViewportState } from "./types";

export type BoardObjectWithMeta = BoardObject & { _updatedAt?: string; board_id?: string };

type BoardState = {
  boardId: string | null;
  objects: Record<string, BoardObjectWithMeta>;
  selection: string | null;
  viewport: ViewportState;
  setBoardId: (boardId: string | null) => void;
  setObjects: (objects: Record<string, BoardObjectWithMeta>) => void;
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, updates: Partial<BoardObject>, updatedAt?: string) => void;
  removeObject: (id: string) => void;
  setSelection: (id: string | null) => void;
  setViewport: (viewport: ViewportState) => void;
  /** Apply remote change with LWW: only if remote updated_at >= local */
  applyRemoteObject: (
    id: string,
    object: BoardObjectWithMeta | null,
    remoteUpdatedAt: string
  ) => void;
};

export const useBoardStore = create<BoardState>((set) => ({
  boardId: null,
  objects: {},
  selection: null,
  viewport: { x: 0, y: 0, scale: 1 },
  setBoardId: (boardId) => set(() => ({ boardId, objects: {} })),
  setObjects: (objects) => set(() => ({ objects })),
  addObject: (object) =>
    set((state) => ({
      objects: { ...state.objects, [object.id]: object },
    })),
  updateObject: (id, updates, updatedAt) =>
    set((state) => {
      const prev = state.objects[id];
      if (!prev) return state;
      const next: BoardObjectWithMeta = {
        ...prev,
        ...updates,
        ...(updatedAt && { _updatedAt: updatedAt }),
      };
      return { objects: { ...state.objects, [id]: next } };
    }),
  removeObject: (id) =>
    set((state) => {
      const next = { ...state.objects };
      delete next[id];
      return { objects: next };
    }),
  setSelection: (id) => set(() => ({ selection: id })),
  setViewport: (viewport) => set(() => ({ viewport })),
  applyRemoteObject: (id, object, remoteUpdatedAt) =>
    set((state) => {
      const local = state.objects[id];
      const localTs = local?._updatedAt ?? "1970-01-01T00:00:00Z";
      if (remoteUpdatedAt < localTs) return state;
      const next = { ...state.objects };
      if (object) {
        next[id] = { ...object, _updatedAt: remoteUpdatedAt };
      } else {
        delete next[id];
      }
      return { objects: next };
    }),
}));
