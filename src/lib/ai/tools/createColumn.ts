import type { ToolContext } from "./types";
import { createStickyNote } from "./createStickyNote";
import { createText } from "./createText";
import { COLUMN_SPACING } from "../templates/constants";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import { measureStickyText, measureTextSnug } from "@/lib/sticky-measure";

export type ColumnItem = {
  text: string;
  color?: string;
  /** If true, use text component as label (white bg, solid border) instead of sticky */
  isLabel?: boolean;
};

/**
 * Create a column of stickies arranged vertically with fixed spacing.
 * If an item has isLabel=true, create a text component (white bg, solid border) instead of a sticky.
 */
export async function createColumn(
  ctx: ToolContext,
  params: {
    items: ColumnItem[];
    x: number;
    y: number;
    spacing?: number;
  },
): Promise<string> {
  const { items, x, y, spacing = COLUMN_SPACING } = params;
  if (items.length === 0) return "Error: No items for column.";

  const createdIds: string[] = [];
  let currentY = y;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const displayText = item.isLabel ? `<strong>${item.text}</strong>` : item.text;
    const { width, height } = item.isLabel
      ? measureTextSnug(displayText)
      : measureStickyText(displayText);
    const cellW = Math.max(DEFAULT_STICKY.width, width);
    const cellH = Math.max(DEFAULT_STICKY.height, height);
    const cellX = x;

    if (item.isLabel) {
      const result = await createText(ctx, {
        text: item.text,
        x: cellX,
        y: currentY,
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
        x: cellX,
        y: currentY,
        color: item.color ?? "yellow",
      });
      const id = result.match(/Id: ([a-f0-9-]{36})/)?.[1];
      if (id) createdIds.push(id);
    }

    currentY += cellH + spacing;
  }

  return `Created column with ${items.length} stickies. Ids: ${createdIds.join(", ")}`;
}
