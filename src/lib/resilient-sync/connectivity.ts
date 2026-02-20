/**
 * Resilient Canvas: Connectivity state machine.
 * Deterministic transitions based on network, realtime, heartbeats, error rate.
 */

export type ConnectivityState =
  | "ONLINE_SYNCED"
  | "ONLINE_SYNCING"
  | "OFFLINE"
  | "DEGRADED"
  | "READONLY_FAILSAFE";

const DEGRADED_ERROR_THRESHOLD = 5;
const DEGRADED_WINDOW_MS = 30_000;
const OFFLINE_RECONNECT_THRESHOLD_MS = 5_000;

type ConnectivityInput = {
  navigatorOnLine: boolean;
  realtimeConnected: boolean;
  realtimeDisconnectedSince: number | null;
  pendingCount: number;
  recentErrors: number;
  recentErrorsWindowStart: number;
  readOnlyFailsafe: boolean;
};

export function computeConnectivityState(
  input: ConnectivityInput
): ConnectivityState {
  if (input.readOnlyFailsafe) {
    return "READONLY_FAILSAFE";
  }

  const now = Date.now();
  const errorsInWindow =
    now - input.recentErrorsWindowStart < DEGRADED_WINDOW_MS
      ? input.recentErrors
      : 0;

  const isOffline =
    !input.navigatorOnLine ||
    (input.realtimeConnected === false &&
      input.realtimeDisconnectedSince != null &&
      now - input.realtimeDisconnectedSince > OFFLINE_RECONNECT_THRESHOLD_MS);

  if (isOffline) {
    return "OFFLINE";
  }

  if (errorsInWindow >= DEGRADED_ERROR_THRESHOLD) {
    return "DEGRADED";
  }

  if (input.pendingCount > 0) {
    return input.realtimeConnected ? "ONLINE_SYNCING" : "ONLINE_SYNCING";
  }

  /* When realtime is briefly disconnected, show ONLINE_SYNCED to avoid flickering "Syncing" */
  return "ONLINE_SYNCED";
}

export function createConnectivityInput(): ConnectivityInput {
  return {
    navigatorOnLine: typeof navigator !== "undefined" ? navigator.onLine : true,
    realtimeConnected: false,
    realtimeDisconnectedSince: null,
    pendingCount: 0,
    recentErrors: 0,
    recentErrorsWindowStart: 0,
    readOnlyFailsafe: false,
  };
}
