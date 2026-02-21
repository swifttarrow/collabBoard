export const DEFAULT_STICKY = { width: 180, height: 120 };
export const DEFAULT_STICKER = { width: 100, height: 100 };
export const DEFAULT_TEXT = { width: 200, height: 80 };
export const DEFAULT_RECT = { width: 220, height: 140 };
export const DEFAULT_CIRCLE = { width: 160, height: 160 };
export const DEFAULT_FRAME = { width: 320, height: 200 };
export const DEFAULT_LINE_LENGTH = 120;

export const COLOR_PRESETS = [
  "#FDE68A", // yellow
  "#FCA5A5", // coral
  "#E2E8F0", // slate
  "#A5F3FC", // cyan
  "#BBF7D0", // mint
  "#F5D0FE", // fuchsia
  "#FED7AA", // peach
];

export const COLOR_PRESET_LABELS: Record<string, string> = {
  "#FDE68A": "Yellow",
  "#FCA5A5": "Coral",
  "#E2E8F0": "Slate",
  "#A5F3FC": "Cyan",
  "#BBF7D0": "Mint",
  "#F5D0FE": "Fuchsia",
  "#FED7AA": "Peach",
};
export const DEFAULT_STICKY_COLOR = COLOR_PRESETS[0];
export const DEFAULT_RECT_COLOR = COLOR_PRESETS[2];
export const DEFAULT_FRAME_COLOR = COLOR_PRESETS[2];

export const COLOR_SWATCH_SIZE = 20;
export const COLOR_SWATCH_GAP = 6;
export const COLOR_SWATCH_PADDING = 8;
export const PALETTE_FLOATING_GAP = 10;
export const COLOR_SELECTED_STROKE = "#0f172a";
export const COLOR_SELECTED_STROKE_WIDTH = 2;

export const TRASH_SIZE = 18;
export const TRASH_PADDING = 6;
export const BUTTON_GAP = 4;
/** Floating button group: each button background */
export const FLOATING_BUTTON_FILL = "#ffffff";
export const FLOATING_BUTTON_STROKE = "#e2e8f0";
export const FLOATING_BUTTON_STROKE_WIDTH = 1;
export const FLOATING_BUTTON_CORNER_RADIUS = 6;
/** Padding between shape and selection box; trash sits in this corner area */
export const TRASH_CORNER_OFFSET = 18;
/** Smaller padding for text selection box (no trash on text) */
export const TEXT_SELECTION_PADDING = 4;
/** Smaller anchor size for text selection handles */
export const TEXT_SELECTION_ANCHOR_SIZE = 4;
export const TRASH_STROKE = "#ef4444";
export const TRASH_STROKE_WIDTH = 2;
/** Offset (px) to displace duplicated entity toward bottom-right */
export const DUPLICATE_OFFSET = 16;
export const COPY_STROKE = "#64748b";
export const COPY_STROKE_WIDTH = 2;

export const MIN_TEXT_WIDTH = 60;
export const MIN_TEXT_HEIGHT = 24;
export const MIN_RECT_WIDTH = 80;
export const MIN_RECT_HEIGHT = 60;
export const MIN_FRAME_WIDTH = 120;
export const MIN_FRAME_HEIGHT = 80;
export const FRAME_HEADER_HEIGHT = 32;
export const MIN_CIRCLE_SIZE = 40;
export const MIN_STICKER_SIZE = 24;
export const MIN_LINE_LENGTH = 20;
/** Snap radius for connector endpoints to attach to nodes (px, in world coords). Larger = easier to connect. */
export const CONNECTOR_SNAP_RADIUS = 24;
/** Stroke when shape is connection target (hover/drag feedback) */
export const CONNECTOR_TARGET_STROKE = "#3b82f6";
export const CONNECTOR_TARGET_STROKE_WIDTH = 3;
export const STICKY_TEXT_PADDING = 12;
export const STICKY_CORNER_RADIUS = 14;
export const RECT_CORNER_RADIUS = 10;
export const SELECTION_STROKE = "#0f172a";
export const SELECTION_STROKE_WIDTH = 3;

export const DRAFT_RECT_FILL = "rgba(59, 130, 246, 0.12)";
export const DRAFT_RECT_STROKE = "#3b82f6";
export const DRAFT_RECT_DASH = [6, 4] as [number, number];
export const DRAFT_CIRCLE_FILL = "rgba(59, 130, 246, 0.12)";
export const DRAFT_CIRCLE_STROKE = "#3b82f6";
export const DRAFT_CIRCLE_DASH = [6, 4] as [number, number];
export const DRAFT_LINE_STROKE = "#3b82f6";
export const DRAFT_LINE_DASH = [6, 4] as [number, number];
/** Dash pattern for connector (dotted) lines */
export const CONNECTOR_LINE_DASH = [6, 4] as [number, number];

export const BOX_SELECT_FILL = "rgba(59, 130, 246, 0.15)";
export const BOX_SELECT_STROKE = "#3b82f6";
export const BOX_SELECT_DASH = [6, 4] as [number, number];

/** Frame drop-target highlight when dragging object into frame (reparent would occur) */
export const DROP_TARGET_STROKE = "#3b82f6";
export const DROP_TARGET_STROKE_WIDTH = 2;
export const DROP_TARGET_FILL = "rgba(59, 130, 246, 0.08)";

export const STICKY_TEXT_FILL = "#1e293b";
export const STICKY_FONT_SIZE = 16;
export const STICKY_SHADOW = {
  color: "#000",
  blur: 8,
  opacity: 0.2,
};
