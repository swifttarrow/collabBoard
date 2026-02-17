# Realtime "mismatch between server and client bindings" - Root Cause Analysis

## The Error

```
[useBoardObjectsSync] Realtime channel error: mismatch between server and client bindings for postgres changes
```

## Root Cause

The Supabase Realtime client compares each postgres_changes binding it sent with the response from the server. The comparison uses `isFilterValueEqual()` for `schema`, `table`, and `filter`:

```javascript
// From @supabase/realtime-js RealtimeChannel.ts
isFilterValueEqual(serverPostgresFilter.filter, filter)
// Implementation: (serverValue ?? undefined) === (clientValue ?? undefined)
```

**The bug:** When we omit `filter` from our config, the client has `filter: undefined`. The server's phx_join schema requires `filter` and uses default `""`. So the server echoes back `filter: ""` (or `filter: null` in some versions). The `??` operator only replaces `null`/`undefined`—it does NOT treat `""` as equivalent. So:
- `"" ?? undefined` → `""` (empty string is preserved)
- `undefined ?? undefined` → `undefined`
- `"" === undefined` → **false** → MISMATCH

## The Fix

Explicitly send `filter: ""` when you don't need row-level filtering:

```javascript
.on("postgres_changes", {
  event: "*",
  schema: "public",
  table: "board_objects",
  filter: "",  // Required to match server response
}, callback)
```

## References

- [supabase/supabase-js#1917](https://github.com/supabase/supabase-js/issues/1917) – Original bug report
- [supabase/supabase-js#1918](https://github.com/supabase/supabase-js/pull/1918) – Fix for `null` vs `undefined` (merged Dec 2025)
- [phx_join.schema.json](https://github.com/supabase/realtime/blob/main/phx_join.schema.json) – Server expects `filter` in postgres_changes items
