import type { ToolContext } from "./types";
import { createColumn } from "./createColumn";
import { COLUMN_SPACING } from "../templates/constants";
import { DEFAULT_STICKY } from "@/components/canvas/constants";

const RETRO_COLUMNS = [
  { label: "What Went Well", items: ["", "", ""] },
  { label: "What Didn't", items: ["", "", ""] },
  { label: "Action Items", items: ["", "", ""] },
];

/**
 * Create a retrospective board with 3 columns:
 * What Went Well, What Didn't, Action Items.
 * Each column has a bold header sticky + 3 empty stickies below.
 * Centered on viewport.
 */
export async function createRetroBoard(
  ctx: ToolContext,
  params: {
    centerX: number;
    centerY: number;
    itemsPerColumn?: number;
  },
): Promise<string> {
  const { centerX, centerY, itemsPerColumn = 3 } = params;

  const columnWidth = DEFAULT_STICKY.width + COLUMN_SPACING;
  const totalWidth = 3 * columnWidth;
  const startX = centerX - totalWidth / 2 + DEFAULT_STICKY.width / 2 + COLUMN_SPACING / 2;

  const emptyItems = Array.from({ length: itemsPerColumn }, () => "");
  const createdIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const col = RETRO_COLUMNS[i]!;
    const columnItems = [
      { text: col.label, isLabel: true },
      ...emptyItems.map((t) => ({ text: t, isLabel: false })),
    ];
    const colX = startX + i * columnWidth;
    const result = await createColumn(ctx, {
      items: columnItems,
      x: colX,
      y: centerY - 200,
      spacing: COLUMN_SPACING,
    });
    const ids = result.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g) ?? [];
    createdIds.push(...ids);
  }

  if (ctx.broadcastViewportCommand && createdIds.length > 0) {
    ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: createdIds });
  }

  return `Created retrospective board with columns: What Went Well, What Didn't, Action Items.`;
}
