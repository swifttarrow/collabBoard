import type { ToolContext } from "./types";
import { createStickyNote } from "./createStickyNote";
import { createText } from "./createText";
import { TABLE_CELL_GAP } from "../templates/constants";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import { measureStickyText, measureTextSnug } from "@/lib/sticky-measure";

/**
 * Create a table: grid of stickies with first row and first column as text labels (white bg, solid border).
 * cells[rowIdx][colIdx] - row 0 and col 0 are headers.
 */
export async function createTable(
  ctx: ToolContext,
  params: {
    /** 2D array of cell text. [0][*] = column headers, [*][0] = row headers. [0][0] = corner. */
    cells: string[][];
    x: number;
    y: number;
    cellGap?: number;
  },
): Promise<string> {
  const { cells, x, y, cellGap = TABLE_CELL_GAP } = params;
  if (cells.length === 0 || cells[0]?.length === 0) {
    return "Error: Empty table.";
  }

  const rows = cells.length;
  const cols = cells[0]!.length;
  const colWidths: number[] = [];
  const rowHeights: number[] = [];

  for (let c = 0; c < cols; c++) {
    let maxW = DEFAULT_STICKY.width;
    for (let r = 0; r < rows; r++) {
      const cell = cells[r]?.[c] ?? "";
      const isHeader = r === 0 || c === 0;
      const displayText = isHeader ? `<strong>${cell}</strong>` : cell;
      const { width } = isHeader ? measureTextSnug(displayText) : measureStickyText(displayText);
      maxW = Math.max(maxW, width);
    }
    colWidths[c] = maxW;
  }

  for (let r = 0; r < rows; r++) {
    let maxH = DEFAULT_STICKY.height;
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c] ?? "";
      const isHeader = r === 0 || c === 0;
      const displayText = isHeader ? `<strong>${cell}</strong>` : cell;
      const { height } = isHeader ? measureTextSnug(displayText) : measureStickyText(displayText);
      maxH = Math.max(maxH, height);
    }
    rowHeights[r] = maxH;
  }

  const createdIds: string[] = [];
  let currentY = y;

  for (let r = 0; r < rows; r++) {
    let currentX = x;
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c] ?? "";
      const isHeader = r === 0 || c === 0;
      const cellW = colWidths[c] ?? DEFAULT_STICKY.width;
      const cellH = rowHeights[r] ?? DEFAULT_STICKY.height;

      if (isHeader) {
        const result = await createText(ctx, {
          text: cell || " ",
          x: currentX,
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
          text: cell || " ",
          x: currentX,
          y: currentY,
          color: "yellow",
        });
        const id = result.match(/Id: ([a-f0-9-]{36})/)?.[1];
        if (id) createdIds.push(id);
      }

      currentX += cellW + cellGap;
    }
    currentY += (rowHeights[r] ?? DEFAULT_STICKY.height) + cellGap;
  }

  return `Created table ${rows}x${cols}. Ids: ${createdIds.slice(0, 5).join(", ")}${createdIds.length > 5 ? "..." : ""}.`;
}
