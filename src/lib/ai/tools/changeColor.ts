import type { BoardObjectRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function changeColor(
  ctx: ToolContext,
  params: { objectId: string; color: string }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  const obj = objects[params.objectId];
  if (!obj) return `Error: Object ${params.objectId} not found`;

  const color = resolveColor(params.color);

  const { data: updated, error } = await supabase
    .from("board_objects")
    .update({ color })
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
  return `Changed color of ${params.objectId} to ${color}`;
}
