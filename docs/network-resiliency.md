# Network Resiliency

This document answers:

**How is resiliency implemented to account for network degradation or outage?**

---

## Goals

- **Never lose user work**: All edits are stored locally before being sent.
- **Offline editing**: Users can create, edit, and delete objects without a network connection.
- **Eventual consistency**: When connectivity returns, queued changes sync to the server.
- **Clear feedback**: Users see connection status (Online, Offline, Syncing, Degraded).

---

## Architecture

See [Resilient Canvas Sync](./resilient_canvas_sync.md) for the full design. Summary:

### 1. Local-First Flow

- User actions apply **immediately** to the Zustand store (optimistic updates).
- Each change becomes an **operation** (create/update/delete) enqueued in **IndexedDB**.
- The outbox persists across reloads and crashes.

### 2. Send Loop

- Every **2 seconds** (when online and Realtime connected), the client:
  - Reads pending ops from the outbox.
  - POSTs each to `/api/boards/[id]/ops`.
  - On success: marks acked, updates `serverRevision`, broadcasts to other clients.
  - On 4xx: marks failed (e.g., auth/validation errors).
  - On 5xx/network error: leaves op pending for retry.

### 3. Snapshot Cache

- On load, the client:
  - Reads cached snapshot from IndexedDB (if present) for fast initial render.
  - Fetches latest from `/api/boards/[id]/snapshot`.
  - Rebases any pending outbox ops on top of the snapshot.

### 4. Connectivity States

| State             | Condition                      | UX                    |
| ----------------- | ------------------------------ | --------------------- |
| ONLINE_SYNCED     | Connected, outbox empty        | Green dot, "Online"   |
| ONLINE_SYNCING    | Connected, pending ops         | Green dot, "Syncing…" |
| OFFLINE           | No network or Realtime down    | Gray dot, "Offline"   |
| DEGRADED          | High error rate (e.g. 5 in 30s)| Yellow dot            |
| READONLY_FAILSAFE | Data integrity risk            | Red, block writes     |

### 5. Online Event

- When `navigator.onLine` becomes true, the client calls `drainOutbox()` and shows "Reconnected. Syncing changes…".

---

## Key Mechanisms

- **Idempotency**: Each op has `opId`; the server deduplicates. Retries do not create duplicate objects.
- **Base revision**: Ops include `baseRevision` for ordering. On reconnect, the client fetches the latest snapshot and reapplies pending ops.
- **Safety limits**: Warn at 500 pending ops; critical at 5,000 to prevent unbounded growth.

---

## Key Files

| File                                              | Purpose                    |
| ------------------------------------------------- | -------------------------- |
| `src/lib/resilient-sync/outbox-db.ts`             | IndexedDB outbox + cache   |
| `src/lib/resilient-sync/connectivity.ts`           | State machine logic        |
| `src/lib/resilient-sync/operations.ts`             | Op creation                |
| `src/lib/resilient-sync/apply-op.ts`              | Apply op to local state    |
| `src/components/canvas/hooks/useBoardObjectsSync.ts` | Main sync hook          |
| `src/components/canvas/ConnectionBadge.tsx`       | Connection status UI       |
