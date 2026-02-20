import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { DEFAULT_TEXT } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function createText(
  ctx: ToolContext,
  params: { text: string; x: number; y: number },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();
  const content = params.text.trim() || "Text";
  const html = content.includes("<") ? content : `<p>${content}</p>`;
  const object: BoardObject = {
    id,
    type: "text",
    parentId: null,
    x: params.x,
    y: params.y,
    width: DEFAULT_TEXT.width,
    height: DEFAULT_TEXT.height,
    rotation: 0,
    color: "#94a3b8",
    text: html,
  };

  const row = objectToRow(object, boardId);
  const { data: inserted, error } = await supabase
    .from("board_objects")
    .insert(row)
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
    )
    .single();

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId,
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });
  return `Created text "${content}" at (${params.x}, ${params.y}). Id: ${withMeta.id}`;
}
