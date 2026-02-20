"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBoardStore } from "@/lib/board/store";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { useVersionHistoryStore } from "@/lib/version-history/store-core";
import {
  createHistoryEntry,
  createRestoreEntry,
  applyEntryToState,
  computeStateAt,
} from "@/lib/version-history/ops";
import type { BoardObject } from "@/lib/board/types";

type PersistFunctions = {
  addObject: (object: BoardObject) => void;
  updateObject: (id: string, updates: Partial<BoardObject>) => void;
  removeObject: (id: string) => void;
  restoreToState?: (targetState: Record<string, BoardObjectWithMeta>) => Promise<void>;
};

type VersionHistoryContextValue = {
  boardId: string;
  recordOp: (
    opType: "create" | "update" | "delete",
    payload: unknown,
    prevOrDeleted: BoardObjectWithMeta | null
  ) => void;
  setBaseStateIfEmpty: (objects: Record<string, BoardObjectWithMeta>) => void;
  registerPersist: (persist: PersistFunctions | null) => void;
  undo: () => void;
  redo: () => void;
  save: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  openHistoryPanel: boolean;
  setOpenHistoryPanel: (open: boolean) => void;
  /** Restore to a specific server revision (from cross-user history) */
  restoreToRevision: (
    targetState: Record<string, BoardObjectWithMeta>,
    targetRevision: number
  ) => void;
  /** Legacy: restore to local history index (for undo/redo compatibility) */
  goToIndex: (index: number) => void;
};

const VersionHistoryContext = createContext<VersionHistoryContextValue | null>(null);

export function useVersionHistory(): VersionHistoryContextValue {
  const ctx = useContext(VersionHistoryContext);
  if (!ctx) throw new Error("useVersionHistory must be used within VersionHistoryProvider");
  return ctx;
}

export function useVersionHistoryOptional(): VersionHistoryContextValue | null {
  return useContext(VersionHistoryContext);
}

type Props = {
  boardId: string;
  children: ReactNode;
};

export function VersionHistoryProvider({ boardId, children }: Props) {
  const persistRef = useRef<PersistFunctions | null>(null);
  const [openHistoryPanel, setOpenHistoryPanelState] = useState(false);
  const setOpenHistoryPanel = useCallback((open: boolean) => {
    setOpenHistoryPanelState(open);
    useVersionHistoryStore.getState().setHistoryPanelOpen(open);
  }, []);

  const setObjects = useBoardStore((s) => s.setObjects);

  const recordOp = useCallback(
    (opType: "create" | "update" | "delete", payload: unknown, prevOrDeleted: BoardObjectWithMeta | null) => {
      const entry =
        opType === "create"
          ? createHistoryEntry("create", payload as BoardObjectWithMeta, null)
          : opType === "update"
            ? createHistoryEntry("update", payload as { id: string } & Partial<BoardObject>, prevOrDeleted!)
            : createHistoryEntry("delete", payload as string, prevOrDeleted!);
      useVersionHistoryStore.getState().push(entry);
    },
    []
  );

  const setBaseStateIfEmpty = useCallback(
    (objects: Record<string, BoardObjectWithMeta>) => {
      useVersionHistoryStore.getState().setBaseState(objects);
    },
    []
  );

  const registerPersist = useCallback((persist: PersistFunctions | null) => {
    persistRef.current = persist;
  }, []);

  const undo = useCallback(() => {
    const store = useVersionHistoryStore.getState();
    if (!store.canUndo()) return;
    const entry = store.undo();
    if (!entry) return;

    store.setApplyingUndoRedo(true);
    const persist = persistRef.current;
    try {
      const current = useBoardStore.getState().objects;
      const next = applyEntryToState(entry, "inverse", current);
      setObjects(next);
      if (entry.opType === "restore") {
        /* Restore entries: local only, no persist */
      } else if (persist) {
        if (entry.opType === "create") {
          persist.removeObject(entry.objectId);
        } else if (entry.opType === "update") {
          const inv = entry.inversePayload as Record<string, unknown>;
          if (inv && typeof inv === "object" && "id" in inv) {
            persist.updateObject(inv.id as string, inv as Partial<BoardObject>);
          }
        } else {
          const obj = entry.inversePayload as BoardObjectWithMeta;
          persist.addObject(obj);
        }
      }
    } finally {
      store.setApplyingUndoRedo(false);
    }
  }, [setObjects]);

  const redo = useCallback(() => {
    const store = useVersionHistoryStore.getState();
    if (!store.canRedo()) return;
    const entry = store.redo();
    if (!entry) return;

    store.setApplyingUndoRedo(true);
    const persist = persistRef.current;
    try {
      const current = useBoardStore.getState().objects;
      const next = applyEntryToState(entry, "forward", current);
      setObjects(next);
      if (entry.opType === "restore") {
        /* Restore entries: local only, no persist */
      } else if (persist) {
        if (entry.opType === "create") {
          persist.addObject(entry.forwardPayload as BoardObject);
        } else if (entry.opType === "update") {
          const fwd = entry.forwardPayload as Record<string, unknown>;
          if (fwd && typeof fwd === "object" && "id" in fwd) {
            persist.updateObject(fwd.id as string, fwd as Partial<BoardObject>);
          }
        } else {
          persist.removeObject((entry.forwardPayload as { id: string }).id);
        }
      }
    } finally {
      store.setApplyingUndoRedo(false);
    }
  }, [setObjects]);

  const save = useCallback(() => {
    return useVersionHistoryStore.getState().saveCheckpoint();
  }, []);

  const canUndo = useVersionHistoryStore((s) => s.past.length > 0);
  const canRedo = useVersionHistoryStore((s) => s.future.length > 0);
  const hasUnsavedChanges = useVersionHistoryStore((s) => s.hasUnsavedChanges());

  const restoreToRevision = useCallback(
    (targetState: Record<string, BoardObjectWithMeta>, _targetRevision: number) => {
      const currentState = useBoardStore.getState().objects;

      setObjects(targetState);

      const persist = persistRef.current;
      if (persist?.restoreToState) {
        void persist.restoreToState(targetState);
      }

      const store = useVersionHistoryStore.getState();
      const restoreEntry = createRestoreEntry(
        targetState,
        currentState,
        Date.now()
      );
      store.push(restoreEntry);
    },
    [setObjects]
  );

  const goToIndex = useCallback(
    (index: number) => {
      const store = useVersionHistoryStore.getState();
      const { past, baseState } = store;
      if (index < -1 || index >= past.length) return;

      const targetState =
        index < 0
          ? { ...baseState }
          : computeStateAt(past, index, baseState);
      const currentState = useBoardStore.getState().objects;

      setObjects(targetState);

      const persist = persistRef.current;
      if (persist?.restoreToState) {
        void persist.restoreToState(targetState);
      }

      const restoredEntry = past[index];
      const restoredTimestamp = restoredEntry?.timestamp ?? Date.now();
      const restoreEntry = createRestoreEntry(
        targetState,
        currentState,
        restoredTimestamp
      );
      store.push(restoreEntry);
    },
    [setObjects]
  );

  useEffect(() => {
    useVersionHistoryStore.getState().clear();
  }, [boardId]);

  const value = useMemo<VersionHistoryContextValue>(
    () => ({
      boardId,
      recordOp,
      setBaseStateIfEmpty,
      registerPersist,
      undo,
      redo,
      save,
      canUndo,
      canRedo,
      hasUnsavedChanges,
      openHistoryPanel,
      setOpenHistoryPanel,
      restoreToRevision,
      goToIndex,
    }),
    [
      boardId,
      recordOp,
      setBaseStateIfEmpty,
      registerPersist,
      undo,
      redo,
      save,
      canUndo,
      canRedo,
      hasUnsavedChanges,
      openHistoryPanel,
      setOpenHistoryPanel,
      restoreToRevision,
      goToIndex,
    ]
  );

  return (
    <VersionHistoryContext.Provider value={value}>
      {children}
    </VersionHistoryContext.Provider>
  );
}
