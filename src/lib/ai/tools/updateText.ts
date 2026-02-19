import type { BoardObjectRow } from "@/lib/board/sync";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function updateText(
  ctx: ToolContext,
  params: { objectId: string; newText: string }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  const obj = objects[params.objectId];
  if (!obj) return `Error: Object ${params.objectId} not found`;

  const { data: updated, error } = await supabase
    .from("board_objects")
    .update({ text: params.newText })
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
  return `Updated text of ${params.objectId}`;
}
