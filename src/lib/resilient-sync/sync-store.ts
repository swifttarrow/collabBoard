/**
 * Resilient Canvas: Zustand store for sync state (connectivity, pending, etc.)
 */

import { create } from "zustand";
import type { ConnectivityState } from "./connectivity";

type SyncState = {
  connectivityState: ConnectivityState;
  pendingCount: number;
  failedCount: number;
  serverRevision: number;
  lastSyncMessage: string | null;
  /** True when we just came back from offline and are draining the outbox */
  recoveringFromOffline: boolean;
  setConnectivityState: (s: ConnectivityState) => void;
  setPendingCount: (n: number) => void;
  setFailedCount: (n: number) => void;
  setServerRevision: (r: number) => void;
  setLastSyncMessage: (m: string | null) => void;
  setRecoveringFromOffline: (v: boolean) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  connectivityState: "OFFLINE",
  pendingCount: 0,
  failedCount: 0,
  serverRevision: 0,
  lastSyncMessage: null,
  recoveringFromOffline: false,
  setConnectivityState: (connectivityState) => set({ connectivityState }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setFailedCount: (failedCount) => set({ failedCount }),
  setServerRevision: (serverRevision) => set({ serverRevision }),
  setLastSyncMessage: (lastSyncMessage) => set({ lastSyncMessage }),
  setRecoveringFromOffline: (recoveringFromOffline) => set({ recoveringFromOffline }),
}));
