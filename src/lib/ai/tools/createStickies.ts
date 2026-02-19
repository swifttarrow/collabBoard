import { DEFAULT_STICKY } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { createStickyNote } from "./createStickyNote";

const STICKY_WIDTH = DEFAULT_STICKY.width;
const STICKY_HEIGHT = DEFAULT_STICKY.height;
const GRID_GAP = 28;
const STICKY_COLS = 3;

export async function createStickies(
  ctx: ToolContext,
  params: {
    stickies: Array<{ text: string; color?: string }>;
    startX?: number;
    startY?: number;
  }
): Promise<string> {
  const stickies = Array.isArray(params.stickies)
    ? params.stickies.filter((s) => s != null && typeof (s as { text?: unknown }).text === "string")
    : [];
  if (stickies.length === 0) return "No stickies to create.";

  const startX = params.startX ?? 80;
  const startY = params.startY ?? 80;

  for (let i = 0; i < stickies.length; i++) {
    const col = i % STICKY_COLS;
    const row = Math.floor(i / STICKY_COLS);
    const x = startX + col * (STICKY_WIDTH + GRID_GAP);
    const y = startY + row * (STICKY_HEIGHT + GRID_GAP);
    await createStickyNote(ctx, {
      text: stickies[i]!.text,
      x,
      y,
      color: stickies[i]?.color,
    });
  }

  return `Created ${stickies.length} stickies at (${startX}, ${startY})`;
}
