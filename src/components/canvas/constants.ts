export const DEFAULT_STICKY = { width: 180, height: 120 };
export const DEFAULT_RECT = { width: 220, height: 140 };

export const COLOR_PRESETS = ["#FDE68A", "#FCA5A5", "#FFFFFF"];
export const DEFAULT_STICKY_COLOR = COLOR_PRESETS[0];
export const DEFAULT_RECT_COLOR = COLOR_PRESETS[2];

export const COLOR_SWATCH_SIZE = 18;
export const COLOR_SWATCH_GAP = 6;
export const COLOR_SWATCH_PADDING = 6;
export const COLOR_SELECTED_STROKE = "#0f172a";
export const COLOR_SELECTED_STROKE_WIDTH = 2;

export const TRASH_SIZE = 18;
export const TRASH_PADDING = 6;
export const TRASH_STROKE = "#ef4444";
export const TRASH_STROKE_WIDTH = 2;

export const MIN_RECT_WIDTH = COLOR_SWATCH_PADDING * 2 + COLOR_SWATCH_SIZE;
export const MIN_RECT_HEIGHT =
  COLOR_SWATCH_PADDING * 2 +
  COLOR_SWATCH_SIZE * 5 +
  COLOR_SWATCH_GAP * 4;
export const STICKY_TEXT_PADDING = 12;
export const STICKY_CORNER_RADIUS = 14;
export const RECT_CORNER_RADIUS = 10;
export const SELECTION_STROKE = "#0f172a";
export const SELECTION_STROKE_WIDTH = 2;

export const DRAFT_RECT_FILL = "rgba(59, 130, 246, 0.12)";
export const DRAFT_RECT_STROKE = "#3b82f6";
export const DRAFT_RECT_DASH = [6, 4] as [number, number];

export const STICKY_TEXT_FILL = "#1e293b";
export const STICKY_FONT_SIZE = 16;
export const STICKY_SHADOW = {
  color: "#000",
  blur: 8,
  opacity: 0.2,
};
