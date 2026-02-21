# Board Previews

This document answers:

**How are board previews generated?**

---

## Overview

The boards list page shows a small thumbnail preview for each board. Previews are generated server-side from `board_objects` data and rendered client-side as SVG.

---

## Data Acquisition

### Server (`src/app/boards/page.tsx`)

1. Fetches `board_objects` (up to 2000 rows, ordered by `updated_at` desc).
2. Filters to **root objects only** (`parent_id` is null). Objects inside frames are skipped; the preview shows top-level objects only.
3. Builds `previewByBoardId`: up to **40 objects per board** (`PREVIEW_OBJECTS_PER_BOARD = 40`).
4. Each preview object includes: `id`, `type`, `parentId`, `x`, `y`, `width`, `height`, `color`, `text`, `data`.

---

## Rendering (`BoardPreview`)

### Bounds

- `getAbsoluteBounds()` computes the bounding box of all preview objects in world coordinates, accounting for `parentId` via `getAbsolutePosition()`.
- Empty boards use a default bounds `{ minX: 0, minY: 0, maxX: 400, maxY: 300 }`.

### Scaling

- Preview size: **200×120** px with **8** px padding.
- `toScale()` maps world coordinates to preview pixels:
  - Scale is `Math.min(scaleX, scaleY, 1)` so content fits without upscaling.
  - Content is centered in the preview area.

### Object Types

- **rect, circle, frame, sticker**: Rendered as shapes (rect/ellipse) with appropriate fill and stroke.
- **text, sticky**: Rendered as rectangles with a truncated text snippet (font size and max chars derived from dimensions).
- **line**: Rendered as a line from `(x, y)` to `(x2, y2)` or `(endX, endY)` from `data`.

---

## Flow

```
Server: board_objects query → previewByBoardId (40 objs/board)
    ↓
BoardsPageContent receives allBoards with previewObjects
    ↓
BoardPreview({ objects }) → SVG with scaled shapes
```

Previews are static at page load; they do not update in real time. A full board load would be needed to see live changes.
