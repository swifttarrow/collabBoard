# Presence and Cursors

This document answers:

1. **What is interpolation and why are we using it?**
2. **How does showing of cursor positions work?**
3. **What's the purpose of throttling cursor tracking?**

---

## 1. What is interpolation and why are we using it?

**Interpolation** is the technique of smoothly transitioning between discrete position updates to create a fluid visual display. For cursor presence, we receive position updates at a limited rate (~30 Hz due to throttling). Without interpolation, cursors would jump instantly between positions, which looks choppy—especially when the network adds latency or packets arrive out of order.

### How it works

- **Sending side**: Each cursor broadcast includes a timestamp `t`. Receivers use this to drop out-of-order packets and for interpolation.
- **Receiving side**: `CursorPresenceLayer` runs a `requestAnimationFrame` loop that lerps (linearly interpolates) each cursor's displayed position toward the latest received target position. The formula uses an exponential smoothing factor: `alpha = 1 - exp(-dt / LERP_MS)` with `LERP_MS = 80`, so positions converge in ~80ms.

```ts
// CursorPresenceLayer.tsx
const LERP_MS = 80;
const alpha = 1 - Math.exp(-dt / LERP_MS);
displayPos.x = lerp(current.x, target.x, alpha);
displayPos.y = lerp(current.y, target.y, alpha);
```

This produces smooth, natural-looking cursor motion even when updates are sparse or delayed.

---

## 2. How does showing of cursor positions work?

### Architecture

- **`BoardPresenceProvider`**: Sets up a Supabase Realtime channel (`board_presence:{boardId}`) with presence tracking and broadcast.
- **`trackCursor(worldPoint)`**: Called on every pointer move (when not throttled). Converts screen coordinates to world coordinates and broadcasts a `cursor` event with `{ x, y, userId, color, name, t }`.
- **`cursorsRef`**: A ref holding `Record<userId, CursorPresence>`. Receivers update this on `broadcast` events. The ref is shared so the render loop can read it without triggering React re-renders on every cursor packet.
- **`CursorPresenceLayer`**: A Konva `Layer` that renders the cursor avatar (Path icon) and name label for each user. It runs an animation loop that:
  1. Reads `cursorsRef.current`
  2. Lerps each cursor's displayed position toward the target
  3. Writes positions into `Group` nodes via `group.x()` / `group.y()` and calls `layer.batchDraw()` for efficient canvas updates.

### Coordinate system

Cursors are stored in **world coordinates** (board space), not screen pixels. This ensures they stay aligned with the canvas content when the user pans or zooms.

### Offline state

When `connectivityState === "OFFLINE"`, the layer renders at reduced opacity (0.4) to indicate stale presence data.

---

## 3. What's the purpose of throttling cursor tracking?

Cursor position updates are **throttled to ~30 Hz** (`CURSOR_SEND_MS = 33`). Without throttling:

1. **Network load**: Pointer move events fire 60–120+ times per second. Sending each one would flood the Realtime channel and consume bandwidth.
2. **Receiver overhead**: Other clients would process hundreds of broadcasts per second per user, causing unnecessary CPU work and potentially lag.
3. **Smoothness**: At ~30 Hz, interpolation still provides visually smooth motion. The receiver’s lerp loop fills gaps between updates.

Throttling is implemented by checking `now - lastSendTimeRef.current < CURSOR_SEND_MS` before sending; if the interval hasn’t elapsed, the update is skipped.

### Related throttling

- **Viewport tracking** (for follow-user) is throttled separately at `VIEWPORT_SEND_MS = 100` to reduce broadcast volume when a user is being followed.
