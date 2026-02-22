---
name: code-quality-audit
description: Prevents common bugs from the CollabBoard audit—XSS, async leaks, silent failures, performance issues. Use during code review, when adding sync/persistence, or when touching error handling.
---

# Code Quality Audit Checklist

Use when reviewing code or adding features that touch sync, persistence, UI rendering, or error handling.

## Security

- [ ] **XSS**: Any `dangerouslySetInnerHTML` must sanitize input (DOMPurify) with an explicit allowlist of tags
- [ ] **Auth**: API routes verify resource access explicitly (don't rely solely on RLS)

## Error Handling

- [ ] **Catch blocks**: No empty `catch {}`—log with `console.error` at minimum; use toast for user-facing failures
- [ ] **Promises**: Every `outboxEnqueue`, `fetch`, or async persist path has `.catch()` to avoid unhandled rejections

## Async & Realtime

- [ ] **useEffect async setup**: Use `mounted` guard; check before creating channels/subscriptions; ensure cleanup runs when setup promise resolves
- [ ] **Cleanup**: Unsubscribe/remove channels on unmount; flush pending debounced writes before teardown

## Performance

- [ ] **Debounce**: High-frequency updates (drag, mouse move) that persist—debounce 100–150ms
- [ ] **Memoization**: Handlers passed to frequently re-rendering children use `useCallback`; heavy children use `React.memo`

## Logic

- [ ] **Dead code**: No identical branches in ternaries; remove superseded hooks/components
- [ ] **State machine**: When `pendingCount > 0` and `realtimeConnected === false`, show DEGRADED (not SYNCI NG)

## Output

If issues found, fix before merging. Reference `.cursor/rules/` for concrete patterns.
