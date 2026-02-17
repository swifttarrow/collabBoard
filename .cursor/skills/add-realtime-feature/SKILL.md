---
name: add-realtime-feature
description: Guides adding or modifying realtime subscriptions, broadcasts, or sync logic with idempotent events, database as source of truth, and safe state updates. Use when adding or modifying realtime subscriptions, broadcasts, or sync logic.
---

# Add or Modify Realtime Feature

## When to Use

Use when adding or modifying realtime subscriptions, broadcasts, or sync logic.

## Steps

### 1. Ensure events are idempotent

- Include `eventId` on every event
- Include `timestamp` on every event

### 2. Ensure database is source of truth

- Do not rely solely on client state
- Writes must persist to database before optimistic UI updates
- Use database state to reconcile or overwrite stale client state when needed

### 3. Update client state safely

- Avoid duplicate events (de-duplicate by `eventId`)
- Avoid infinite update loops (do not trigger writes from handlers that also receive writes)
- Apply updates in a deterministic way

### 4. Ensure proper subscription cleanup

- Unsubscribe on component unmount or when dependencies change
- Avoid orphaned subscriptions and memory leaks

### 5. Verify behavior with multiple clients

- Test concurrent edits, rapid changes, and reconnection scenarios

## Never

- Never assume events arrive in order
- Never assume events arrive once
- Never trust client state as source of truth

## Output

Provide:

1. **Realtime subscription code** – channel setup, filters, and subscribe/unsubscribe
2. **Event structure** – payload schema including `eventId` and `timestamp`
3. **State update logic** – how handlers merge or replace state, including de-duplication
