# Connector Snapping

This document answers:

**How does snapping of connectors work?**

---

## Overview

Connectors (lines) can attach to shapes at predefined **anchors** (e.g., corners, midpoints). When creating a connector or moving an endpoint near a shape, the system checks if the point is within a **snap radius**. If so, the endpoint snaps to the nearest anchor and is stored as an attached endpoint rather than a free-floating world position.

---

## Snap Radius

- Defined in `src/components/canvas/constants.ts`: `CONNECTOR_SNAP_RADIUS = 10` (world units).
- A point must be within 10 units of an anchor (or shape center) to snap.

---

## Anchors

Each connectable shape (rect, circle, sticky, text, frame) exposes anchors via `getShapeAnchors()` in `src/lib/line/geometry.ts`. Anchors include:

- Corners: `top-left`, `top-right`, `bottom-left`, `bottom-right`
- Midpoints: `left-mid`, `right-mid`, `top-mid`, `bottom-mid`
- Center: `right-mid` is also used as the shape center for snapping

---

## `findNearestNodeAndAnchor`

The core snapping function:

```ts
findNearestNodeAndAnchor(
  point: { x: number; y: number },
  objects: Record<string, BoardObject>,
  excludeId?: string,
  snapRadius = 10
): { nodeId: string; anchor: AnchorKind; dist: number } | null
```

- Iterates over connectable objects (excluding lines and `excludeId`).
- For each object, tests all anchors and the center.
- Returns the nearest anchor within `snapRadius`, or `null` if none are in range.

---

## Where Snapping Is Used

1. **Creating a connector** (`useObjectCreators`, `useLineCreation`):
   - When finishing a line, both start and end points are checked.
   - If either is within `CONNECTOR_SNAP_RADIUS` of a shape anchor, the line’s `data.start` or `data.end` is stored as `{ type: "attached", nodeId, anchor }` instead of raw coordinates.

2. **Moving a connector endpoint** (`CanvasBoard`):
   - When dragging a line handle near a shape, `findNearestNodeAndAnchor` is called.
   - If a snap is found, the endpoint is attached to that anchor; otherwise it remains a free position.

---

## Data Representation

Attached endpoint:

```ts
{ type: "attached", nodeId: "shape-uuid", anchor: "right-mid" }
```

Free endpoint (when not snapped):

```ts
{ type: "position", x: 100, y: 200 }
```

The line geometry (`getLineGeometry`) resolves attached endpoints to world coordinates using `getAbsoluteAnchorPoint()` so rendering and hit-testing work correctly.
