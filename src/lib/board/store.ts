import { create } from "zustand";
import type { BoardObject, ViewportState } from "./types";

type BoardState = {
  objects: Record<string, BoardObject>;
  selection: string | null;
  viewport: ViewportState;
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, updates: Partial<BoardObject>) => void;
  removeObject: (id: string) => void;
  setSelection: (id: string | null) => void;
  setViewport: (viewport: ViewportState) => void;
};

export const useBoardStore = create<BoardState>((set) => ({
  objects: {},
  selection: null,
  viewport: { x: 0, y: 0, scale: 1 },
  addObject: (object) =>
    set((state) => ({
      objects: { ...state.objects, [object.id]: object },
    })),
  updateObject: (id, updates) =>
    set((state) => ({
      objects: {
        ...state.objects,
        [id]: { ...state.objects[id], ...updates },
      },
    })),
  removeObject: (id) =>
    set((state) => {
      const next = { ...state.objects };
      delete next[id];
      return { objects: next };
    }),
  setSelection: (id) => set(() => ({ selection: id })),
  setViewport: (viewport) => set(() => ({ viewport })),
}));
