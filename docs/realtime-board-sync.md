# Realtime Syncing of Board Objects

This document answers:

**How does realtime syncing of board objects work?**

---

## Overview

Board objects (stickies, shapes, text, connectors, etc.) sync in real time across all collaborators through a **local-first** architecture: changes are applied to the UI immediately, then sent to the server and broadcast to other clients.

---

## Data Flow

```
User action → Apply to Zustand store → Enqueue op to IndexedDB outbox
                    ↓
            (immediate UI update)
                    ↓
        Send loop (every 2s when online)
                    ↓
        POST /api/boards/[id]/ops
                    ↓
        Server: apply_board_operation() → DB write
                    ↓
        Client broadcasts committed op on Realtime channel
                    ↓
        Other clients: applyRemoteObject()
```

---

## Key Components

### 1. `useBoardObjectsSync`

The main hook that:

- Loads initial state from `/api/boards/[id]/snapshot` (or IndexedDB cache when offline)
- Exposes `addObject`, `updateObject`, `removeObject` that:
  - Apply changes to the Zustand store immediately (optimistic)
  - Create operations and enqueue them in the IndexedDB outbox
- Subscribes to the Realtime channel `board_objects:{boardId}`
- On `board_objects` broadcast: applies remote changes via `applyRemoteObject`
- Runs a 2-second send loop to drain pending ops when online

### 2. Realtime Channel

- **Event**: `board_objects`
- **Payloads**:
  - `{ op: "INSERT", object }` — new object
  - `{ op: "UPDATE", object }` — updated object
  - `{ op: "DELETE", id, updated_at }` — deleted object

Payloads include `_sentAt` for latency metrics. Clients apply via the store’s `applyRemoteObject`, which uses Last-Write-Wins by `updated_at`.

### 3. Ops API

- **POST `/api/boards/[id]/ops`**: Accepts idempotent operations. Each op has an `opId`; the server deduplicates and applies via `apply_board_operation()`.
- On success, the client broadcasts the committed change to the Realtime channel so other clients see it.

---

## Why Not Direct Realtime DB Subscription?

The app uses a **snapshot + ops** model instead of Supabase Realtime’s `postgres_changes` for `board_objects` because:

1. **Offline support**: Ops are queued in IndexedDB and sent when back online.
2. **Conflict resolution**: Ops carry `baseRevision` and `updated_at` for deterministic ordering.
3. **Idempotency**: `opId` deduplication prevents double-apply on retries.

See [Resilient Canvas Sync](./resilient_canvas_sync.md) for full architecture details.
