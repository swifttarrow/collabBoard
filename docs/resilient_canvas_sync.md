# Resilient Canvas Sync

Technical documentation for the local-first, offline-capable board sync implementation.

## Goals

- **Never lose user work**: User actions are preserved locally immediately.
- **Fast, continuous interaction**: Editing does not block on the network.
- **Eventual consistency**: Once connectivity returns, all clients converge on the same board state.
- **Clear user feedback**: Users understand when they’re offline or out-of-sync without being interrupted.
- **Safe multi-user collaboration**: Conflicts resolve predictably.

## Architecture Overview

```mermaid
flowchart TB
    subgraph Client
        UI[Canvas UI]
        Store[(Zustand Store)]
        Outbox[(IndexedDB Outbox)]
        Cache[(Snapshot Cache)]
        UI -->|1. Apply locally| Store
        UI -->|2. Enqueue| Outbox
        Store -->|On load| Cache
    end

    subgraph Sync Loop
        Send[Send Loop 2s]
        Outbox -->|Pending ops| Send
        Send -->|POST /api/boards/[id]/ops| API
        API -->|Success| Broadcast[Realtime Broadcast]
        Broadcast -->|Remote ops| Other[Other Clients]
    end

    subgraph Server
        API[Ops API Route]
        RPC[apply_board_operation]
        API --> RPC
        RPC --> DB[(board_objects)]
        RPC --> Ops[(board_operations)]
    end
```

### Data Flow

1. **User action** → Apply to store immediately (no network wait).
2. **Enqueue** → Create op (create/update/delete), add to IndexedDB outbox.
3. **Send loop** → When online, POST pending ops to `/api/boards/[id]/ops` with retry.
4. **Server** → Apply via `apply_board_operation()`, dedupe by `opId`, increment `boards.revision`.
5. **Broadcast** → Client broadcasts committed op to Realtime channel; other clients apply via `applyRemoteObject`.

## Data Model

### Operation (op)

Every board mutation is an idempotent op:

| Field           | Type   | Description                                      |
| --------------- | ------ | ------------------------------------------------- |
| opId            | UUID   | Globally unique; used for deduplication           |
| clientId        | string | Device/browser session ID                         |
| boardId         | UUID   | Target board                                     |
| timestamp       | number | Client wall clock (UX)                           |
| baseRevision    | number | Last server revision when op was created         |
| type            | string | `create` \| `update` \| `delete`                 |
| payload         | object | Type-specific (full object, partial updates, id) |
| idempotencyKey  | string | Usually same as opId                             |

### Payloads by Type

- **create**: Full `BoardObject` (id, type, x, y, width, height, etc.)
- **update**: `{ id, ...partial }` – only changed fields
- **delete**: `{ id }`

### Database

- **boards.revision**: Monotonically incremented for each committed op.
- **board_operations**: Stores `(op_id, board_id, server_revision)` for idempotency.
- **board_history**: Stores full op payloads with `user_id` for the version history panel; written by `apply_board_operation()` alongside each applied op.
- **apply_board_operation()**: Postgres function that checks `op_id`, applies op, updates revision, inserts into `board_history`, returns `{ applied, revision }`.

## Connectivity States

| State             | Condition                        | UX                                   |
| ----------------- | -------------------------------- | ------------------------------------ |
| ONLINE_SYNCED     | Connected, outbox empty          | Green dot, "Online"                  |
| ONLINE_SYNCING    | Connected, pending ops           | Green dot, spinner, "Syncing…"       |
| OFFLINE           | No network or Realtime down      | Gray dot, "Offline", pending count   |
| DEGRADED          | High error rate (e.g. 5 in 30s)  | Yellow dot, "Degraded"               |
| READONLY_FAILSAFE | Data integrity risk              | Red, "Read-only", block writes       |

Transitions are based on `navigator.onLine`, Realtime connection status, heartbeat timeouts, and error rate.

## Local-First Flow

### Immediate Local Apply

1. User creates/updates/deletes an object.
2. Zustand store is updated immediately.
3. Op is created and enqueued to IndexedDB outbox.
4. UI does not wait on the network.

### Persistent Outbox

- Stored in IndexedDB (`collabboard-resilient` DB, `outbox` store).
- Survives page refresh and crash.
- On reload, outbox is restored and drained when online.

### Snapshot + Log Strategy

- **Snapshot cache**: Latest server snapshot + `serverRevision` in IndexedDB.
- **On startup**: Load from cache for fast initial render, then fetch latest snapshot from `/api/boards/[id]/snapshot`.
- **Rebase**: When reconnecting, fetch latest snapshot and re-apply pending outbox ops on top.

## Sync Protocol

### Client Send Loop

- Runs every 2 seconds when online and Realtime is connected.
- Fetches pending ops from outbox (FIFO).
- POSTs each op to `/api/boards/[id]/ops`.
- On success: mark acked, update `serverRevision`, broadcast to other clients.
- On 4xx (auth/validation): mark failed, surface in UI.
- On 5xx/network error: retry later (exponential backoff implicit in interval).

### Server

- Accepts ops with idempotency via `apply_board_operation()`.
- If `op_id` exists in `board_operations`, returns existing revision (no re-apply).
- Otherwise applies op to `board_objects`, increments `boards.revision`, inserts into `board_operations`.

### Conflict Resolution (LWW)

- Per field: last-committed op wins.
- Delete wins over later updates (tombstones).
- Text: last-write-wins on full text field (MVP).

### Rebase

- When reconnecting, client may have ops against an older `baseRevision`.
- Fetch latest snapshot, apply remote ops, re-apply local pending ops in order.
- If a local op targets a deleted object, mark as skipped (non-blocking warning).

## Safety Limits

- **Warn at 500 ops**: Non-blocking message, e.g. "Consider refreshing."
- **Critical at 5,000 ops**: Prompt user to refresh or save locally; optionally switch to READONLY_FAILSAFE.

## Key Files

| File                                       | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `src/lib/resilient-sync/operations.ts`     | Op types, `createOp()`                               |
| `src/lib/resilient-sync/outbox-db.ts`      | IndexedDB outbox and snapshot cache                  |
| `src/lib/resilient-sync/connectivity.ts`   | State machine logic                                  |
| `src/lib/resilient-sync/sync-store.ts`     | Zustand store for connectivity, pending, revision    |
| `src/lib/resilient-sync/apply-op.ts`       | Apply op to local state                              |
| `src/components/canvas/hooks/useBoardObjectsSync.ts` | Main sync hook, local-first flow              |
| `src/app/api/boards/[id]/ops/route.ts`     | POST endpoint for op submission                      |
| `src/app/api/boards/[id]/snapshot/route.ts`| GET endpoint for board state + revision              |
| `src/components/canvas/ConnectionBadge.tsx`| Connection status UI                                 |
| `supabase/migrations/0010_resilient_sync_ops.sql` | DB migration                               |
| `supabase/migrations/0011_board_history.sql`      | board_history table; 0014 restores insert in apply_board_operation |

## Broadcast Format

Committed ops are broadcast to the Realtime channel for other clients:

```ts
// INSERT
{ op: "INSERT", object: BoardObjectWithMeta, _sentAt?: number }

// UPDATE
{ op: "UPDATE", object: BoardObjectWithMeta, _sentAt?: number }

// DELETE
{ op: "DELETE", id: string, updated_at: string, _sentAt?: number }
```

Clients apply via `applyRemoteObject(id, object | null, updated_at)` with last-write-wins by `updated_at`.

## AI Tools Compatibility

AI tools (createStickyNote, moveObject, etc.) still write directly to `board_objects` via the server. They do not go through the ops API. As a result:

- AI changes appear in the snapshot on next fetch.
- `boards.revision` is not incremented for AI writes.
- For full consistency, AI tools could later be migrated to emit ops via the same pipeline.

## Risks and Mitigations

| Risk                       | Mitigation                                              |
| -------------------------- | ------------------------------------------------------- |
| Migration not applied      | Run `supabase db push` before using; document in README |
| Outbox grows unbounded     | Warn at 500, fail-safe at 5,000 ops                     |
| Multi-tab double-sends     | Server dedupes by opId; no duplicate application        |
| Partial snapshot load      | Render without assets; retry in background              |
| No session (e.g. incognito, new user) | Sync setup requires `userId` and `access_token`; if missing, ops stay in outbox and are never sent. User sees local changes until refresh. |

## Test Steps

1. **Run migration**
   ```bash
   supabase db push
   ```

2. **Offline edit + reconnect**
   - Turn off network (DevTools → Network → Offline).
   - Create, edit, delete objects.
   - Refresh page – changes persist (IndexedDB).
   - Turn network back on – changes sync.

3. **Connection badge**
   - Online: green dot, "Online".
   - Offline: gray dot, "Offline", pending count.
   - Reconnect: "Syncing…" then "Online".

4. **Unit tests**
   ```bash
   pnpm test -- --run src/lib/resilient-sync
   ```
