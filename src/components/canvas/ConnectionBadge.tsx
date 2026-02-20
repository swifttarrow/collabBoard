"use client";

import { useSyncStore } from "@/lib/resilient-sync";
import type { ConnectivityState } from "@/lib/resilient-sync/connectivity";

const STATE_CONFIG: Record<
  ConnectivityState,
  { label: string; dotColor: string; showSpinner: boolean }
> = {
  ONLINE_SYNCED: { label: "Online", dotColor: "bg-emerald-500", showSpinner: false },
  ONLINE_SYNCING: {
    label: "Syncing…",
    dotColor: "bg-emerald-500",
    showSpinner: true,
  },
  OFFLINE: { label: "Offline", dotColor: "bg-slate-400", showSpinner: false },
  DEGRADED: { label: "Degraded", dotColor: "bg-amber-500", showSpinner: true },
  READONLY_FAILSAFE: {
    label: "Read-only",
    dotColor: "bg-rose-500",
    showSpinner: false,
  },
};

export function ConnectionBadge() {
  const connectivityState = useSyncStore((s) => s.connectivityState);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const failedCount = useSyncStore((s) => s.failedCount);
  const lastSyncMessage = useSyncStore((s) => s.lastSyncMessage);
  const recoveringFromOffline = useSyncStore((s) => s.recoveringFromOffline);

  /* Only show "Syncing" spinner/label when recovering from offline; otherwise stay as "Online" */
  const effectiveState =
    connectivityState === "ONLINE_SYNCING" && !recoveringFromOffline
      ? "ONLINE_SYNCED"
      : connectivityState;
  const config = STATE_CONFIG[effectiveState];
  const pendingLabel =
    pendingCount > 0 ? `${pendingCount} pending` : null;
  const failedLabel =
    failedCount > 0 ? `${failedCount} failed` : null;

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm shadow-sm"
      title={lastSyncMessage ?? undefined}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${config.dotColor}`}
          aria-hidden
        />
        {config.showSpinner && (
          <svg
            className="h-3.5 w-3.5 animate-spin text-slate-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className="text-slate-700">{config.label}</span>
      </span>
      {pendingLabel && (
        <span className="text-slate-500" aria-label={`${pendingCount} changes pending`}>
          ({pendingLabel})
        </span>
      )}
      {failedLabel && (
        <span className="text-rose-600" aria-label={`${failedCount} changes failed`}>
          ({failedLabel})
        </span>
      )}
    </div>
  );
}
