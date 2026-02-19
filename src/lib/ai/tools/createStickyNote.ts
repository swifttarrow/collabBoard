import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function createStickyNote(
  ctx: ToolContext,
  params: { text: string; x: number; y: number; color?: string }
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();
  const color = params.color ? resolveColor(params.color) : "#FDE68A";
  const object: BoardObject = {
    id,
    type: "sticky",
    parentId: null,
    x: params.x,
    y: params.y,
    width: DEFAULT_STICKY.width,
    height: DEFAULT_STICKY.height,
    rotation: 0,
    color,
    text: params.text,
  };

  const row = objectToRow(object, boardId);
  const { data: inserted, error } = await supabase
    .from("board_objects")
    .insert(row)
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .single();

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });
  return `Created sticky note "${params.text}" at (${params.x}, ${params.y}). Id: ${withMeta.id}`;
}
