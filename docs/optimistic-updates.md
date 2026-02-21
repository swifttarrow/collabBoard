# Optimistic Updates

This document answers:

**What is the purpose of using optimistic updates?**

---

## Definition

**Optimistic updates** mean applying user changes to the local UI immediately, before the server confirms them. The UI does not wait for network round-trips.

---

## Purpose

1. **Instant feedback**: Users see their edits appear right away instead of waiting for server latency (often 100–500ms or more). This makes the app feel responsive.
2. **Continuous interaction**: Users can create, move, resize, or delete multiple objects without pauses. Editing does not block on the network.
3. **Offline usability**: When the network is unavailable, changes still apply locally. Once reconnected, queued ops are sent and eventually reach the server.

---

## How It Works in CollabBoard

1. User performs an action (e.g., moves a sticky, creates a line).
2. The sync layer (`useBoardObjectsSync`) calls `addObject`, `updateObject`, or `removeObject`.
3. **Immediately**:
   - The Zustand store is updated (`addObjectStore`, `updateObjectStore`, `removeObjectStore`).
   - React re-renders and the canvas reflects the change.
4. **Asynchronously**:
   - An operation is created and enqueued to the IndexedDB outbox.
   - A send loop (every 2 seconds when online) POSTs pending ops to the server.
   - On success, the op is removed from the outbox and broadcast to other clients.
   - On failure, the op stays in the outbox for retry; the UI keeps the optimistic state.

---

## Relation to Conflict Resolution

Optimistic updates create the possibility of conflicts (e.g., two users edit the same object). The app uses **Last-Write-Wins (LWW)** by `updated_at` in `applyRemoteObject`. If a remote change has a newer timestamp, it overwrites the local state. See [Conflict Resolution](./conflict-resolution.md) for details.

---

## Trade-offs

- **Pros**: Fast, fluid UX; works offline; no blocking on network.
- **Cons**: Remote updates can overwrite local changes. For a collaborative whiteboard, LWW per object is an acceptable trade-off; more complex apps might use CRDTs or OT.
