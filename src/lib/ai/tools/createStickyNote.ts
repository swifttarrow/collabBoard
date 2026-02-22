import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import { computeFanOutPlacement } from "@/lib/ai/viewport-placement";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";
import { measureStickyText } from "@/lib/sticky-measure";

export async function createStickyNote(
  ctx: ToolContext,
  params: {
    text: string;
    x: number;
    y: number;
    color?: string;
    parentId?: string | null;
    placeAtCenter?: { viewportCenterX: number; viewportCenterY: number };
  },
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  const id = crypto.randomUUID();
  const color = params.color ? resolveColor(params.color) : "#FDE68A";
  const { width, height } = measureStickyText(params.text);

  const { x, y } = params.placeAtCenter
    ? computeFanOutPlacement(
        params.placeAtCenter.viewportCenterX,
        params.placeAtCenter.viewportCenterY,
        width,
        height,
        objects
      )
    : { x: params.x, y: params.y };

  const object: BoardObject = {
    id,
    type: "sticky",
    parentId: params.parentId ?? null,
    x,
    y,
    width,
    height,
    rotation: 0,
    color,
    text: params.text,
  };

  const row = objectToRow(object, boardId);
  const { data: inserted, error } = await supabase
    .from("board_objects")
    .insert(row)
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
    )
    .single();

  if (error) {
    console.error("[createStickyNote] insert error:", error);
    return `Error: ${error.message}`;
  }
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId,
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });

  return `Created sticky note "${params.text}" at (${x}, ${y}). Id: ${withMeta.id}`;
}
