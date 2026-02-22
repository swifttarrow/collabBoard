/** Default spacing between stickies in a column (vertical). */
export const COLUMN_SPACING = 16;
/** Default spacing between stickies in a row (horizontal). */
export const ROW_SPACING = 16;
/** Gap between objects when using moveAll template. */
export const MOVE_ALL_GAP = 20;

/** moveAll layout templates: where to place objects relative to anchor (viewport center). */
export type MoveAllTemplate =
  | "right"   /* Stack vertically on the right side */
  | "left"    /* Stack vertically on the left side */
  | "top"     /* Stack horizontally along the top */
  | "bottom"  /* Stack horizontally along the bottom */
  | "center"  /* Compact cluster in center */
  | "grid";   /* Grid layout (use cols) */
/** Gap between frames in a 2x2 quadrant grid. */
export const QUADRANT_GAP = 8;
/** Default gap between table cells. */
export const TABLE_CELL_GAP = 12;
/** Offset of label text from frame. */
export const LABEL_OFFSET_FROM_FRAME = 8;
