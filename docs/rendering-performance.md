# Rendering Performance During Panning

This document answers:

**How do we optimize Konva rendering performance when panning?**

---

## Challenge

During panning (or zooming), the viewport changes frequently. Without optimization, React would re-render the entire scene on every viewport update, and Konva would redraw all nodes — including those off-screen. On large boards, this can cause jank.

---

## Viewport Culling

The main optimization is **viewport culling** in `BoardSceneGraph`: nodes outside the visible area (plus a margin) are not rendered at all.

### Implementation

1. **Viewport bounds in world coordinates**:

   The visible area is computed from `viewport` (x, y, scale) and stage dimensions:

   ```ts
   worldMargin = CULL_MARGIN_SCREEN_PX / viewport.scale
   minX = (-viewport.x) / viewport.scale - worldMargin
   maxX = (stageWidth - viewport.x) / viewport.scale + worldMargin
   // similarly for Y
   ```

   `CULL_MARGIN_SCREEN_PX = 240` is converted to world units and added on all sides so nodes slightly off-screen are still rendered during fast pans (reducing pop-in).

2. **Intersection test**:

   Each object’s bounding box (absolute position + size) is tested against the viewport bounds. Lines use their geometry’s bounding box. If `intersects(viewportBounds, objectBounds)` is false, the node is skipped.

3. **Always-visible set**:

   Objects that must always render (e.g., selected, hovered, dragged) are kept in `alwaysVisibleIds` and bypass culling.

---

## Result

- **On pan**: Only objects in or near the viewport are rendered. Off-screen nodes do not create Konva nodes or trigger draw calls.
- **Batch draw**: `CursorPresenceLayer` uses `layer.batchDraw()` in its animation loop instead of forcing full scene redraws.

---

## Other Considerations

- **Konva Layer**: The main content lives in a single Layer; viewport changes update the Group’s `x`, `y`, `scaleX`, `scaleY`. Konva’s internal batching helps during rapid viewport updates.
- **listening={false}**: Non-interactive layers (e.g., cursor layer) use `listening={false}` to avoid hit-testing overhead.
- **React re-renders**: The scene receives `viewport` as a prop; when it changes, `BoardSceneGraph` re-renders and re-evaluates culling. Culling limits the number of child nodes returned, reducing React reconciliation and Konva draw work.
