import type { ToolContext } from "./types";
import { createStickyNote } from "./createStickyNote";
import { createText } from "./createText";
import { ROW_SPACING } from "../templates/constants";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import { measureStickyText, measureTextSnug } from "@/lib/sticky-measure";

export type RowItem = {
  text: string;
  color?: string;
  /** If true, use text component as label (white bg, solid border) instead of sticky */
  isLabel?: boolean;
};

/**
 * Create a row of stickies arranged horizontally with fixed spacing.
 * If an item has isLabel=true, create a text component (white bg, solid border) instead of a sticky.
 */
export async function createRow(
  ctx: ToolContext,
  params: {
    items: RowItem[];
    x: number;
    y: number;
    spacing?: number;
  },
): Promise<string> {
  const { items, x, y, spacing = ROW_SPACING } = params;
  if (items.length === 0) return "Error: No items for row.";

  const createdIds: string[] = [];
  let currentX = x;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const displayText = item.isLabel ? `<strong>${item.text}</strong>` : item.text;
    const { width, height } = item.isLabel
      ? measureTextSnug(displayText)
      : measureStickyText(displayText);
    const cellW = Math.max(DEFAULT_STICKY.width, width);
    const cellH = Math.max(DEFAULT_STICKY.height, height);
    const cellY = y;

    if (item.isLabel) {
      const result = await createText(ctx, {
        text: item.text,
        x: currentX,
        y: cellY,
        bold: true,
        width: cellW,
        height: cellH,
        color: "#ffffff",
        borderStyle: "solid",
      });
      const id = result.match(/Id: ([a-f0-9-]{36})/)?.[1];
      if (id) createdIds.push(id);
    } else {
      const result = await createStickyNote(ctx, {
        text: displayText,
        x: currentX,
        y: cellY,
        color: item.color ?? "yellow",
      });
      const id = result.match(/Id: ([a-f0-9-]{36})/)?.[1];
      if (id) createdIds.push(id);
    }

    currentX += cellW + spacing;
  }

  return `Created row with ${items.length} stickies. Ids: ${createdIds.join(", ")}`;
}
