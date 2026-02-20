import { DEFAULT_STICKY } from "@/components/canvas/constants";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { measureStickyText } from "@/lib/sticky-measure";
import type { ToolContext } from "./types";
import { createLine } from "./createLine";
import { createText } from "./createText";
import { moveObject } from "./moveObject";
import { updateText } from "./updateText";

const QUADRANT_GAP = 24;
const AXIS_LABEL_OFFSET = 20;
const QUADRANT_COLS = 2;

type Quadrant = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Round up on ties: 0 goes to positive.
 * Quadrants: top-right (x>=0, y>=0), top-left (x<0, y>=0), bottom-right (x>=0, y<0), bottom-left (x<0, y<0).
 */
function getQuadrant(xScore: number, yScore: number): Quadrant {
  const xPositive = xScore >= 0;
  const yPositive = yScore >= 0;
  if (xPositive && yPositive) return "top-right";
  if (!xPositive && yPositive) return "top-left";
  if (xPositive && !yPositive) return "bottom-right";
  return "bottom-left";
}

/**
 * Find placement for the quadrant grid below existing content.
 */
function suggestOrigin(objects: Record<string, BoardObjectWithMeta>): {
  originX: number;
  originY: number;
} {
  const entries = Object.values(objects);
  if (entries.length === 0) return { originX: 400, originY: 400 };

  let maxBottom = 0;
  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") continue;
    if (obj.width != null && obj.height != null) {
      maxBottom = Math.max(maxBottom, abs.y + obj.height);
    }
  }
  return {
    originX: 450,
    originY: maxBottom + 200,
  };
}

/**
 * Place stickies into quadrants by x/y score. Ties round up. Each sticky lives
 * in exactly one quadrant, laid out so all are readable. Draws arrowed axes
 * with labels. Grid is sized to fit all stickies.
 */
export async function clusterStickiesByQuadrant(
  ctx: ToolContext,
  params: {
    xAxisLabel: string;
    yAxisLabel: string;
    placements: Array<{ stickyId: string; xScore: number; yScore: number }>;
    originX?: number;
    originY?: number;
  },
): Promise<string> {
  const { objects } = ctx;
  const { originX: paramOriginX, originY: paramOriginY } = params;
  const { originX: suggestedX, originY: suggestedY } = suggestOrigin(ctx.objects);
  const originX = paramOriginX ?? suggestedX;
  const originY = paramOriginY ?? suggestedY;

  const validPlacements = params.placements.filter(
    (p) => objects[p.stickyId]?.type === "sticky",
  );
  if (validPlacements.length === 0) {
    return "No valid stickies to place by quadrant.";
  }

  const byQuadrant: Record<Quadrant, Array<{ stickyId: string; width: number; height: number; xScore: number; yScore: number }>> = {
    "top-left": [],
    "top-right": [],
    "bottom-left": [],
    "bottom-right": [],
  };

  for (const p of validPlacements) {
    const q = getQuadrant(p.xScore, p.yScore);
    const obj = objects[p.stickyId];
    const text = (obj as { text?: string })?.text ?? "";
    const { width, height } = measureStickyText(text);
    byQuadrant[q].push({
      stickyId: p.stickyId,
      width,
      height,
      xScore: p.xScore,
      yScore: p.yScore,
    });
  }

  const quadrantDims: Record<Quadrant, { width: number; height: number }> = {
    "top-left": { width: 0, height: 0 },
    "top-right": { width: 0, height: 0 },
    "bottom-left": { width: 0, height: 0 },
    "bottom-right": { width: 0, height: 0 },
  };

  for (const q of Object.keys(byQuadrant) as Quadrant[]) {
    const items = byQuadrant[q];
    if (items.length === 0) continue;
    const cols = Math.min(QUADRANT_COLS, items.length);
    const rows = Math.ceil(items.length / cols);
    const colWidths: number[] = [];
    const rowHeights: number[] = [];
    for (let c = 0; c < cols; c++) colWidths[c] = 0;
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      colWidths[col] = Math.max(colWidths[col] ?? 0, items[i]!.width);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, items[i]!.height);
    }
    const w =
      colWidths.reduce((a, x) => a + x, 0) + (cols - 1) * QUADRANT_GAP;
    const h =
      rowHeights.reduce((a, x) => a + x, 0) + (rows - 1) * QUADRANT_GAP;
    quadrantDims[q] = { width: Math.max(w, DEFAULT_STICKY.width), height: Math.max(h, DEFAULT_STICKY.height) };
  }

  const halfW =
    Math.max(
      quadrantDims["top-left"].width,
      quadrantDims["bottom-left"].width,
      quadrantDims["top-right"].width,
      quadrantDims["bottom-right"].width,
    ) / 2 + QUADRANT_GAP;
  const halfH =
    Math.max(
      quadrantDims["top-left"].height,
      quadrantDims["top-right"].height,
      quadrantDims["bottom-left"].height,
      quadrantDims["bottom-right"].height,
    ) / 2 + QUADRANT_GAP;

  const axisLen = Math.max(halfW, halfH, 120);

  await createLine(ctx, {
    startX: originX - axisLen,
    startY: originY,
    endX: originX + axisLen,
    endY: originY,
    startCap: "point",
    endCap: "arrow",
    color: "#64748b",
  });
  await createLine(ctx, {
    startX: originX,
    startY: originY + axisLen,
    endX: originX,
    endY: originY - axisLen,
    startCap: "point",
    endCap: "arrow",
    color: "#64748b",
  });

  await createText(ctx, {
    text: params.xAxisLabel,
    x: originX + axisLen - 60,
    y: originY + AXIS_LABEL_OFFSET,
  });
  await createText(ctx, {
    text: params.yAxisLabel,
    x: originX - 100,
    y: originY - axisLen,
  });

  const results: string[] = [];

  const formatScore = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  for (const q of Object.keys(byQuadrant) as Quadrant[]) {
    const items = byQuadrant[q];
    if (items.length === 0) continue;

    const cols = Math.min(QUADRANT_COLS, items.length);
    const rows = Math.ceil(items.length / cols);
    const colWidths: number[] = [];
    const rowHeights: number[] = [];
    for (let c = 0; c < cols; c++) colWidths[c] = 0;
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      colWidths[col] = Math.max(colWidths[col] ?? 0, items[i]!.width);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, items[i]!.height);
    }

    const totalW =
      colWidths.reduce((a, x) => a + x, 0) + (cols - 1) * QUADRANT_GAP;
    const totalH =
      rowHeights.reduce((a, x) => a + x, 0) + (rows - 1) * QUADRANT_GAP;

    const colOffsets: number[] = [0];
    for (let c = 0; c < cols - 1; c++) {
      colOffsets[c + 1] = (colOffsets[c] ?? 0) + (colWidths[c] ?? 0) + QUADRANT_GAP;
    }
    const rowOffsets: number[] = [0];
    for (let r = 0; r < rows - 1; r++) {
      rowOffsets[r + 1] =
        (rowOffsets[r] ?? 0) + (rowHeights[r] ?? 0) + QUADRANT_GAP;
    }

    let baseX: number;
    let baseY: number;
    switch (q) {
      case "top-left":
        baseX = originX - totalW - QUADRANT_GAP;
        baseY = originY - totalH - QUADRANT_GAP;
        break;
      case "top-right":
        baseX = originX + QUADRANT_GAP;
        baseY = originY - totalH - QUADRANT_GAP;
        break;
      case "bottom-left":
        baseX = originX - totalW - QUADRANT_GAP;
        baseY = originY + QUADRANT_GAP;
        break;
      case "bottom-right":
        baseX = originX + QUADRANT_GAP;
        baseY = originY + QUADRANT_GAP;
        break;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = baseX + (colOffsets[col] ?? 0);
      const y = baseY + (rowOffsets[row] ?? 0);

      const obj = objects[item.stickyId] as { text?: string } | undefined;
      const currentText = (obj?.text ?? "").replace(/<[^>]+>/g, " ").trim();
      const scoreSuffix = `\n\n${params.xAxisLabel}: ${formatScore(item.xScore)}, ${params.yAxisLabel}: ${formatScore(item.yScore)}`;
      await updateText(ctx, {
        objectId: item.stickyId,
        newText: currentText + scoreSuffix,
      });

      const result = await moveObject(ctx, {
        objectId: item.stickyId,
        x,
        y,
        parentId: null,
      });
      results.push(result);
    }
  }

  return `Placed ${validPlacements.length} stickies into quadrants. Axes: ${params.xAxisLabel} (x), ${params.yAxisLabel} (y).`;
}
