# Viewport and Zoom

This document answers:

**What is the minimal rectangle fallback?**

---

## Context

When zooming the viewport to fit an object (e.g., "Find" / "Zoom to object") or when computing scale from content bounds, we need to avoid:

1. **Division by zero**: If the content has zero width or height (e.g., a single point or collapsed shape), dividing by it would fail or produce Infinity.
2. **Extreme zoom**: Very small content would require huge scale factors, which can look wrong or hit scale limits.

---

## Minimal Rectangle Fallback

We enforce a **minimum effective content size** so that width and height are never treated as zero (or too small) when computing scale.

### In `animateViewportToObject` (viewport/tools.ts)

When centering and zooming on a single object:

```ts
const contentW = Math.max(maxX - minX, 60);
const contentH = Math.max(maxY - minY, 40);
```

- **60** and **40** are the minimal rectangle dimensions (in world units).
- If the object is a point or very small (e.g., 1×1), we use 60×40 instead.
- Scale is then computed as `effectiveW / contentW` and `effectiveH / contentH`, which remain finite and reasonable.

### In `useFrameToContent` (useFrameToContent.ts)

When framing the viewport to fit all content:

```ts
const scaleX = effectiveW / Math.max(contentW, 100);
const scaleY = effectiveH / Math.max(contentH, 100);
```

Here the fallback is **100** for both dimensions, producing a similarly safe minimum content size.

---

## Summary

The **minimal rectangle fallback** ensures that whenever we derive a scale from content bounds, we never divide by zero or use impossibly small dimensions. We clamp the effective content size to a minimum (e.g., 60×40 or 100×100) so zoom calculations stay valid and stable.
