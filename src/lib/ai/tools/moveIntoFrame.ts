import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import { moveObject } from "./moveObject";
import { getChildren, getRootObjects } from "@/lib/board/scene-graph";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { colorMatches } from "@/lib/ai/color-map";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { COLUMN_SPACING } from "../templates/constants";

const FRAME_CONTENT_PADDING = 16;
/** Y offset inside frame before content area (below typical label). */
const FRAME_CONTENT_TOP = 48;

type FindFilter = { type?: "sticky" | "text" | "frame" | "rect" | "circle"; color?: string };

function stripHtml(html: string): string {
  return (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function filterObjects(
  objects: Record<string, BoardObjectWithMeta>,
  findFilter: FindFilter
): BoardObjectWithMeta[] {
  let candidates = Object.values(objects).filter((o) => o.type !== "line");
  if (findFilter.type) {
    candidates = candidates.filter((o) => o.type === findFilter.type);
  }
  if (findFilter.color) {
    candidates = candidates.filter((o) =>
      colorMatches(findFilter.color!, o.color ?? "")
    );
  }
  return candidates;
}

function findFrameByLabel(
  objects: Record<string, BoardObjectWithMeta>,
  label: string
): string | null {
  const q = label.trim().toLowerCase();
  const roots = getRootObjects(objects);
  const frames = roots.filter((o) => o.type === "frame");
  for (const frame of frames) {
    const children = getChildren(frame.id, objects);
    for (const child of children) {
      if (child.type === "text") {
        const text = stripHtml((child as { text?: string }).text ?? "");
        if (text.toLowerCase().includes(q)) {
          return frame.id;
        }
      }
    }
  }
  return null;
}

/**
 * Move objects (by filter or ID) into a frame (by ID or label).
 * E.g. "move yellow sticky and blue rectangle into Sprint Planning frame"
 */
export async function moveIntoFrame(
  ctx: ToolContext,
  params: {
    objectIds?: string[];
    findFilters?: FindFilter[];
    frameId?: string;
    frameLabel?: string;
  }
): Promise<string> {
  await getBoardState(ctx);

  const objectList = Object.values(ctx.objects).map((o) => ({
    id: o.id.slice(0, 8),
    type: o.type,
    color: o.color ?? "(none)",
    parentId: o.parentId ?? null,
  }));
  console.log("[moveIntoFrame] called", {
    findFilters: params.findFilters,
    frameLabel: params.frameLabel,
    frameId: params.frameId,
    objectCount: Object.keys(ctx.objects).length,
    objectsOnBoard: objectList,
  });

  const targetFrameId: string | null =
    params.frameId && ctx.objects[params.frameId]?.type === "frame"
      ? params.frameId
      : params.frameLabel
        ? findFrameByLabel(ctx.objects, params.frameLabel)
        : null;

  if (!targetFrameId) {
    const roots = getRootObjects(ctx.objects);
    const frames = roots.filter((o) => o.type === "frame");
    console.log("[moveIntoFrame] frame not found", {
      frameLabel: params.frameLabel,
      rootFrames: frames.map((f) => ({ id: f.id.slice(0, 8), children: getChildren(f.id, ctx.objects).map((c) => ({ type: c.type, text: (c as { text?: string }).text?.slice(0, 30) })) })),
    });
    return params.frameLabel
      ? `Error: No frame found with label containing "${params.frameLabel}".`
      : "Error: No frame found. Provide frameId or frameLabel.";
  }
  console.log("[moveIntoFrame] target frame resolved", { targetFrameId: targetFrameId.slice(0, 8) });

  const idsToMove = new Set<string>();

  if (params.objectIds?.length) {
    for (const id of params.objectIds) {
      const obj = ctx.objects[id];
      if (obj) idsToMove.add(id);
    }
  }

  if (!params.findFilters?.length) {
    console.log("[moveIntoFrame] no findFilters or empty array", { findFilters: params.findFilters });
  }
  if (params.findFilters?.length) {
    for (const filter of params.findFilters) {
      if (filter.type || filter.color) {
        const objs = filterObjects(ctx.objects, filter);
        const allMatched = objs;
        const notInFrame = objs.filter((o) => (o.parentId ?? null) !== targetFrameId);
        console.log("[moveIntoFrame] filter applied", {
          filter: { type: filter.type, color: filter.color },
          matchedCount: objs.length,
          alreadyInFrame: objs.length - notInFrame.length,
        });
        allMatched.forEach((o) => idsToMove.add(o.id));
      } else {
        console.log("[moveIntoFrame] filter skipped (no type or color)", { filter });
      }
    }
  }

  if (idsToMove.size === 0) {
    const hadFilters =
      Array.isArray(params.findFilters) &&
      params.findFilters.some((f) => f.type || f.color);
    if (!hadFilters) {
      return "Error: No findFilters provided. Use findFilters:[{type:'sticky', color:'yellow'}, {type:'rect', color:'blue'}], frameLabel:'Sprint Planning'.";
    }
    return "Error: No objects matched the filters. Check that the board has a yellow sticky and blue rectangle.";
  }

  const frame = ctx.objects[targetFrameId];
  if (!frame || frame.type !== "frame") return "Error: Target frame not found.";
  const frameAbs = getAbsolutePosition(targetFrameId, ctx.objects);

  // Content area starts below the label (text child at top). Find bottom of label.
  const children = getChildren(targetFrameId, ctx.objects);
  const labelBottom = children
    .filter((c) => c.type === "text")
    .reduce((max, c) => Math.max(max, c.y + (c.height ?? 24)), 0);
  const contentTop = labelBottom > 0 ? labelBottom + COLUMN_SPACING : FRAME_CONTENT_TOP;

  // Compute layout: vertical stack in content area, left-aligned
  const orderedIds = [...idsToMove];
  let layoutY = contentTop;
  let layoutX = FRAME_CONTENT_PADDING;

  console.log("[moveIntoFrame] resolved", {
    targetFrameId: targetFrameId.slice(0, 8),
    idsToMove: orderedIds.map((id) => id.slice(0, 8)),
  });

  let movedCount = 0;
  for (const id of orderedIds) {
    const obj = ctx.objects[id];
    if (!obj) continue;

    const h = obj.height ?? 120;
    // Target frame-relative position (in empty content area)
    const localX = layoutX;
    const localY = layoutY;
    layoutY += h + COLUMN_SPACING;

    const absX = frameAbs.x + localX;
    const absY = frameAbs.y + localY;

    const result = await moveObject(ctx, {
      objectId: id,
      x: absX,
      y: absY,
      parentId: targetFrameId,
    });
    if (result.startsWith("Error:")) return result;
    movedCount++;
  }

  if (ctx.broadcastViewportCommand) {
    ctx.broadcastViewportCommand({
      action: "frameToObjects",
      objectIds: [targetFrameId, ...idsToMove],
    });
  }

  return `Moved ${movedCount} object(s) into the frame.`;
}
