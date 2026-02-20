import { DEFAULT_STICKY, DEFAULT_TEXT } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { createText } from "./createText";
import { moveObject } from "./moveObject";

const STICKY_WIDTH = DEFAULT_STICKY.width;
const STICKY_HEIGHT = DEFAULT_STICKY.height;
const GRID_GAP = 28;
const LABEL_TO_GRID_GAP = 16;
const GROUP_GAP = 56;
const CLASSIFY_COLS = 3;

export async function classifyStickies(
  ctx: ToolContext,
  params: {
    categories: Array<{ name: string; stickyIds: string[] }>;
    startX?: number;
    startY?: number;
  },
): Promise<string> {
  const { objects } = ctx;
  const startX = params.startX ?? 80;
  let currentY = params.startY ?? 80;

  const results: string[] = [];

  for (const category of params.categories) {
    const stickyIds = category.stickyIds.filter(
      (id) => objects[id]?.type === "sticky",
    );
    if (stickyIds.length === 0) {
      results.push(`Skipped "${category.name}" (no valid stickies)`);
      continue;
    }

    const textResult = await createText(ctx, {
      text: category.name,
      x: startX,
      y: currentY,
    });
    results.push(textResult);
    currentY += DEFAULT_TEXT.height + LABEL_TO_GRID_GAP;

    const rows = Math.ceil(stickyIds.length / CLASSIFY_COLS);
    for (let i = 0; i < stickyIds.length; i++) {
      const col = i % CLASSIFY_COLS;
      const row = Math.floor(i / CLASSIFY_COLS);
      const x = startX + col * (STICKY_WIDTH + GRID_GAP);
      const y = currentY + row * (STICKY_HEIGHT + GRID_GAP);
      const moveResult = await moveObject(ctx, {
        objectId: stickyIds[i]!,
        x,
        y,
        parentId: null,
      });
      results.push(moveResult);
    }

    currentY += rows * (STICKY_HEIGHT + GRID_GAP) + GROUP_GAP;
  }

  return `Classified into ${params.categories.length} categories:\n${results.join("\n")}`;
}
