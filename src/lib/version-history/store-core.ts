import { create } from "zustand";
import type { HistoryEntry } from "./types";
import type { BoardObjectWithMeta } from "@/lib/board/store";

type VersionHistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Base state before any recorded ops (from initial board load) */
  baseState: Record<string, BoardObjectWithMeta>;
  checkpointIndices: Set<number>;
  lastCheckpointIndex: number;
  _isApplyingUndoRedo: boolean;
  historyPanelOpen: boolean;
};

type VersionHistoryActions = {
  push: (entry: HistoryEntry) => void;
  setBaseState: (state: Record<string, BoardObjectWithMeta>) => void;
  saveCheckpoint: () => boolean;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  getEntryAt: (index: number) => HistoryEntry | null;
  getOrderedEntries: () => Array<HistoryEntry & { index: number; isCheckpoint: boolean }>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  hasUnsavedChanges: () => boolean;
  setApplyingUndoRedo: (v: boolean) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  clear: () => void;
};

const initialState: VersionHistoryState = {
  past: [],
  future: [],
  baseState: {},
  checkpointIndices: new Set(),
  lastCheckpointIndex: -1,
  _isApplyingUndoRedo: false,
  historyPanelOpen: false,
};

export const useVersionHistoryStore = create<VersionHistoryState & VersionHistoryActions>(
  (set, get) => ({
    ...initialState,

    push: (entry) => {
      if (get()._isApplyingUndoRedo) return;
      set((state) => ({
        past: [...state.past, entry],
        future: [],
      }));
    },

    setBaseState: (baseState) => {
      set((state) => {
        if (state.past.length > 0) return state;
        return { baseState: { ...baseState } };
      });
    },

    saveCheckpoint: () => {
      const { past, hasUnsavedChanges } = get();
      if (!hasUnsavedChanges()) return false;
      const idx = past.length - 1;
      set((state) => ({
        checkpointIndices: new Set([...state.checkpointIndices, idx]),
        lastCheckpointIndex: idx,
      }));
      return true;
    },

    undo: () => {
      const { past, future } = get();
      if (past.length === 0) return null;
      const entry = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [entry!, ...future],
      });
      return entry!;
    },

    redo: () => {
      const { past, future } = get();
      if (future.length === 0) return null;
      const entry = future[0];
      set({
        past: [...past, entry!],
        future: future.slice(1),
      });
      return entry!;
    },

    getEntryAt: (index) => get().past[index] ?? null,

    getOrderedEntries: () => {
      const { past, checkpointIndices } = get();
      return past.map((e, i) => ({
        ...e,
        index: i,
        isCheckpoint: checkpointIndices.has(i),
      }));
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    hasUnsavedChanges: () => {
      const { past, lastCheckpointIndex } = get();
      return past.length > lastCheckpointIndex + 1;
    },

    setApplyingUndoRedo: (v) => set({ _isApplyingUndoRedo: v }),
    setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),

    clear: () => set({ ...initialState, baseState: {} }),
  })
);
