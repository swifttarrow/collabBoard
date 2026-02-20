import type { BoardObjectWithMeta } from "@/lib/board/store";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import type { ToolContext } from "./types";
import { createLine } from "./createLine";
import { createText } from "./createText";
import { moveObject } from "./moveObject";
import { updateText } from "./updateText";

const MIN_AXIS_LENGTH = 180;
const BASE_AXIS_PER_ITEM = 14;
const AXIS_LABEL_OFFSET = 24;
const DEFAULT_ORIGIN_X = 250;
const DEFAULT_ORIGIN_Y = 350;

/**
 * Find placement for the grid below existing content.
 */
function suggestOrigin(objects: Record<string, BoardObjectWithMeta>): {
  originX: number;
  originY: number;
} {
  const entries = Object.values(objects);
  if (entries.length === 0)
    return { originX: DEFAULT_ORIGIN_X, originY: DEFAULT_ORIGIN_Y };

  let maxBottom = 0;
  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") continue;
    if (obj.width != null && obj.height != null) {
      maxBottom = Math.max(maxBottom, abs.y + obj.height);
    }
  }
  return {
    originX: DEFAULT_ORIGIN_X,
    originY: maxBottom + 120,
  };
}

/**
 * Place stickies on an x/y grid by score. Stickies get x and y scores and are
 * placed at the corresponding coordinate. Overlaps are allowed. Draws arrowed
 * axes with labels.
 */
export async function clusterStickiesOnGrid(
  ctx: ToolContext,
  params: {
    xAxisLabel: string;
    yAxisLabel: string;
    placements: Array<{ stickyId: string; x: number; y: number }>;
    originX?: number;
    originY?: number;
    scale?: number;
  },
): Promise<string> {
  const { objects } = ctx;
  const { originX: paramOriginX, originY: paramOriginY } = params;
  const { originX: suggestedX, originY: suggestedY } = suggestOrigin(ctx.objects);
  const originX = paramOriginX ?? suggestedX;
  const originY = paramOriginY ?? suggestedY;

  const results: string[] = [];

  const validPlacements = params.placements.filter(
    (p) => objects[p.stickyId]?.type === "sticky",
  );
  if (validPlacements.length === 0) {
    return "No valid stickies to place on grid.";
  }

  const xMin = Math.min(...validPlacements.map((p) => p.x));
  const xMax = Math.max(...validPlacements.map((p) => p.x));
  const yMin = Math.min(...validPlacements.map((p) => p.y));
  const yMax = Math.max(...validPlacements.map((p) => p.y));
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const axisLen = Math.max(
    MIN_AXIS_LENGTH,
    validPlacements.length * BASE_AXIS_PER_ITEM,
  );

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

  const formatScore = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  for (const p of validPlacements) {
    const xNorm = (p.x - xMin) / xRange;
    const yNorm = (p.y - yMin) / yRange;
    const px = originX - axisLen + xNorm * 2 * axisLen;
    const py = originY + axisLen - yNorm * 2 * axisLen;

    const obj = objects[p.stickyId] as { text?: string } | undefined;
    const currentText = (obj?.text ?? "").replace(/<[^>]+>/g, " ").trim();
    const scoreSuffix = `\n\n${params.xAxisLabel}: ${formatScore(p.x)}, ${params.yAxisLabel}: ${formatScore(p.y)}`;
    const newText = currentText + scoreSuffix;

    await updateText(ctx, { objectId: p.stickyId, newText });

    const result = await moveObject(ctx, {
      objectId: p.stickyId,
      x: px,
      y: py,
      parentId: null,
    });
    results.push(result);
  }

  return `Placed ${validPlacements.length} stickies on grid. Axes: ${params.xAxisLabel} (x), ${params.yAxisLabel} (y).`;
}
