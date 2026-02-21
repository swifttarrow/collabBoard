# Conflict Resolution

This document answers:

**How does conflict resolution work?**

---

## Strategy: Last-Write-Wins (LWW)

CollabBoard uses **Last-Write-Wins** per object. When multiple clients modify the same object, the version with the most recent `updated_at` timestamp wins.

---

## Implementation

### Store: `applyRemoteObject`

```ts
applyRemoteObject: (id, object, remoteUpdatedAt) =>
  set((state) => {
    const local = state.objects[id];
    const localTs = local?._updatedAt ?? "1970-01-01T00:00:00Z";
    if (remoteUpdatedAt < localTs) return state;  // Ignore older remote
    // Apply newer remote
    const next = { ...state.objects };
    if (object) next[id] = { ...object, _updatedAt: remoteUpdatedAt };
    else delete next[id];
    return { objects: next };
  }),
```

- If the remote `updated_at` is older than the local one, the update is ignored.
- Otherwise, the remote object (or deletion) replaces the local state.

### Server-Side Timestamps

- `board_objects.updated_at` is set by a database trigger on every UPDATE.
- Inserts use `DEFAULT now()`.
- This ensures a single, canonical ordering for concurrent edits.

---

## Idempotency and Deduplication

- Each operation has an `opId`. The server stores `(op_id, board_id, server_revision)` and ignores duplicate `op_id` submissions. This prevents double-apply on retries.
- Realtime broadcasts include the committed object with `_updatedAt`; clients apply via `applyRemoteObject` for LWW.

---

## Tombstones (Deletes)

- A delete is represented as `applyRemoteObject(id, null, updated_at)`.
- If a delete has a newer `updated_at` than a later update, the delete wins (object stays deleted). The store compares timestamps; no special tombstone logic is needed beyond LWW.

---

## Text and Partial Updates

- Text fields use full replacement, not merging. Last write wins on the entire text field.
- Partial updates (e.g., `{ x, y }` only) are applied as patches. The server merges into the row; the client receives the full object in broadcasts. LWW applies to the object as a whole.

---

## Limitations

- **No merging**: Concurrent edits to the same field (e.g., two users typing in the same sticky) will overwrite one another. For richer collaboration, CRDTs or operational transform would be needed.
- **Intent preservation**: LWW does not preserve user intent—it simply picks the chronologically latest state. For a whiteboard, this is usually acceptable.
