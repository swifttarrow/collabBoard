import type { BoardObjectRow } from "@/lib/board/sync";
import {
  MIN_FRAME_WIDTH,
  MIN_FRAME_HEIGHT,
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  MIN_CIRCLE_SIZE,
} from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function resizeObject(
  ctx: ToolContext,
  params: { objectId: string; width: number; height: number }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  const obj = objects[params.objectId];
  if (!obj) return `Error: Object ${params.objectId} not found`;
  if (obj.type === "line") return `Error: Cannot resize a line`;

  const width = Math.max(
    obj.type === "frame" ? MIN_FRAME_WIDTH : obj.type === "circle" ? MIN_CIRCLE_SIZE : MIN_RECT_WIDTH,
    params.width
  );
  const height = Math.max(
    obj.type === "frame" ? MIN_FRAME_HEIGHT : obj.type === "circle" ? MIN_CIRCLE_SIZE : MIN_RECT_HEIGHT,
    params.height
  );

  const { data: updated, error } = await supabase
    .from("board_objects")
    .update({ width, height })
    .eq("id", params.objectId)
    .eq("board_id", boardId)
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .single();

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    updated as BoardObjectRow & { updated_at: string },
    boardId
  );
  broadcast({ op: "UPDATE", object: withMeta });
  return `Resized ${params.objectId} to ${width}x${height}`;
}
