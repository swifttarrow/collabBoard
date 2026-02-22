import type { BoardObjectRow } from "@/lib/board/sync";
import {
  getAbsolutePosition,
  wouldCreateCycle,
} from "@/lib/board/scene-graph";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function moveObject(
  ctx: ToolContext,
  params: {
    objectId: string;
    x: number;
    y: number;
    parentId?: string | null;
  }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  const obj = objects[params.objectId];
  if (!obj) return `Error: Object ${params.objectId} not found`;

  let x = params.x;
  let y = params.y;
  const newParentId = params.parentId ?? obj.parentId ?? null;
  const parentId = newParentId;

  if (
    params.parentId !== undefined &&
    (params.parentId ?? null) !== (obj.parentId ?? null)
  ) {
    if (
      params.parentId != null &&
      wouldCreateCycle(obj.id, params.parentId, objects)
    ) {
      return `Error: Cannot move ${params.objectId} into ${params.parentId} (would create cycle)`;
    }
    // params.x, params.y are target absolute (board) position
    if (params.parentId != null) {
      const parentAbs = getAbsolutePosition(params.parentId, objects);
      x = params.x - parentAbs.x;
      y = params.y - parentAbs.y;
    }
  }

  console.log("[moveObject] updating", {
    objectId: params.objectId,
    boardId,
    x,
    y,
    parentId,
  });

  const { data: updated, error } = await supabase
    .from("board_objects")
    .update({ x, y, parent_id: parentId })
    .eq("id", params.objectId)
    .eq("board_id", boardId)
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .single();

  if (error) {
    console.error("[moveObject] update error", { objectId: params.objectId, error: error.message });
    return `Error: ${error.message}`;
  }
  const withMeta = toObjectWithMeta(
    updated as BoardObjectRow & { updated_at: string },
    boardId
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "UPDATE", object: withMeta });
  return `Moved ${params.objectId} to (${x}, ${y})${parentId ? ` into frame ${parentId}` : ""}`;
}
