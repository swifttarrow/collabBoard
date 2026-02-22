import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getRootObjects, getAbsolutePosition } from "@/lib/board/scene-graph";
import { resolveColor } from "@/lib/ai/color-map";

const DEFAULT_GAP = 16;
const DEFAULT_START_X = 80;
const DEFAULT_START_Y = 80;

/**
 * Arrange objects in a grid layout.
 * When objectIds is empty, uses findFilter or all root-level objects.
 */
export async function arrangeInGrid(
  ctx: ToolContext,
  params: {
    objectIds?: string[];
    cols?: number;
    rows?: number;
    gap?: number;
    startX?: number;
    startY?: number;
    /** When provided, grid is centered at this point (viewport center). */
    centerX?: number;
    centerY?: number;
    layout?: "grid" | "vertical" | "horizontal" | "diagonal";
    findFilter?: { type?: "sticky" | "text" | "frame" | "rect" | "circle"; color?: string };
  }
): Promise<string> {
  console.log("[arrangeInGrid] called", {
    params: JSON.stringify(params),
    findFilter: params.findFilter,
    cols: params.cols,
  });

  await getBoardState(ctx);

  const totalObjects = Object.keys(ctx.objects).length;
  console.log("[arrangeInGrid] after getBoardState", { totalObjects });

  let ids: string[];

  if (params.objectIds?.length && params.objectIds.filter((id) => ctx.objects[id]).length) {
    ids = params.objectIds.filter((id) => ctx.objects[id]);
    console.log("[arrangeInGrid] using objectIds", { count: ids.length });
  } else if (params.findFilter) {
    const filter = params.findFilter;
    const colorHex = filter.color ? resolveColor(filter.color) : null;
    let candidates = Object.values(ctx.objects).filter((o) => o.type !== "line");
    console.log("[arrangeInGrid] findFilter path", {
      filter,
      colorHex,
      beforeTypeFilter: candidates.length,
      sampleColors: candidates.slice(0, 5).map((o) => ({ id: o.id, type: o.type, color: o.color })),
    });
    if (filter.type) {
      candidates = candidates.filter((o) => o.type === filter.type);
      console.log("[arrangeInGrid] after type filter", { count: candidates.length });
    }
    if (colorHex) {
      const hexNorm = colorHex.toLowerCase();
      candidates = candidates.filter(
        (o) => (o.color ?? "").trim().toLowerCase() === hexNorm
      );
      console.log("[arrangeInGrid] after color filter", {
        count: candidates.length,
        hexNorm,
        actualColors: candidates.map((o) => o.color),
      });
    }
    ids = candidates.map((o) => o.id);
  } else {
    ids = getRootObjects(ctx.objects).map((o) => o.id);
    console.log("[arrangeInGrid] using root objects", { count: ids.length });
  }

  if (ids.length === 0) {
    console.log("[arrangeInGrid] no objects to arrange, returning error");
    const hint = params.findFilter
      ? ` No objects matching ${params.findFilter.type ?? "any type"}${params.findFilter.color ? ` color ${params.findFilter.color}` : ""}.`
      : "";
    return `Error: No valid objects to arrange.${hint}`;
  }

  const layout = params.layout ?? "grid";
  const gap = params.gap ?? DEFAULT_GAP;

  let maxW = 0;
  let maxH = 0;
  for (const id of ids) {
    const obj = ctx.objects[id];
    if (obj && obj.width != null && obj.height != null) {
      maxW = Math.max(maxW, obj.width);
      maxH = Math.max(maxH, obj.height);
    }
  }
  const cellW = maxW + gap;
  const cellH = maxH + gap;

  const cols =
    layout === "vertical"
      ? 1
      : layout === "horizontal"
        ? ids.length
        : params.cols ?? Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / cols);

  const cx = params.centerX;
  const cy = params.centerY;

  let startX: number;
  let startY: number;

  if (layout === "diagonal") {
    const n = ids.length;
    const totalDx = (n - 1) * cellW;
    const totalDy = (n - 1) * cellH;
    if (cx != null && cy != null) {
      startX = Math.round(cx - totalDx / 2);
      startY = Math.round(cy - totalDy / 2);
    } else {
      startX = params.startX ?? DEFAULT_START_X;
      startY = params.startY ?? DEFAULT_START_Y;
    }
  } else if (cx != null && cy != null) {
    startX = Math.round(cx - ((cols - 1) * cellW + maxW) / 2);
    startY = Math.round(cy - ((rows - 1) * cellH + maxH) / 2);
  } else {
    startX = params.startX ?? DEFAULT_START_X;
    startY = params.startY ?? DEFAULT_START_Y;
  }
  console.log("[arrangeInGrid] placing", { idsLength: ids.length, layout, cols, startX, startY, useViewportCenter: cx != null });

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const obj = ctx.objects[id];
    if (!obj) continue;

    let gridX: number;
    let gridY: number;
    if (layout === "diagonal") {
      gridX = startX + i * cellW;
      gridY = startY + i * cellH;
    } else {
      const col = i % cols;
      const rowIdx = Math.floor(i / cols);
      gridX = startX + col * cellW;
      gridY = startY + rowIdx * cellH;
    }

    let x = gridX;
    let y = gridY;
    const objParentId = obj.parentId ?? null;
    if (objParentId) {
      const parentAbs = getAbsolutePosition(objParentId, ctx.objects);
      x = gridX - parentAbs.x;
      y = gridY - parentAbs.y;
    }

    const result = await moveObject(ctx, {
      objectId: id,
      x,
      y,
      parentId: objParentId,
    });
    if (i < 2) {
      console.log("[arrangeInGrid] moveObject result", { id, x, y, parentId: objParentId, result: result.slice(0, 60) });
    }
    if (result.startsWith("Error:")) return result;
  }

  if (ctx.broadcastViewportCommand && ids.length > 0) {
    ctx.broadcastViewportCommand({ action: "frameToObjects", objectIds: ids });
  }

  const layoutLabel =
    layout === "diagonal"
      ? "diagonal"
      : layout === "horizontal"
        ? "horizontal line"
        : layout === "vertical"
          ? "vertical line"
          : `${cols}-column grid`;
  console.log("[arrangeInGrid] done", { arrangedCount: ids.length });
  return `Arranged ${ids.length} objects in a ${layoutLabel}.`;
}
