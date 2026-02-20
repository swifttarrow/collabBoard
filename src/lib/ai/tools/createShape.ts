import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import {
  MIN_RECT_WIDTH,
  MIN_RECT_HEIGHT,
  MIN_CIRCLE_SIZE,
} from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function createShape(
  ctx: ToolContext,
  params: {
    type: "rect" | "circle";
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();
  const color = params.color ? resolveColor(params.color) : "#E2E8F0";

  const width =
    params.type === "circle"
      ? Math.max(MIN_CIRCLE_SIZE, Math.min(params.width, params.height))
      : Math.max(MIN_RECT_WIDTH, params.width);
  const height =
    params.type === "circle"
      ? Math.max(MIN_CIRCLE_SIZE, Math.min(params.width, params.height))
      : Math.max(MIN_RECT_HEIGHT, params.height);

  const object: BoardObject = {
    id,
    type: params.type,
    parentId: null,
    x: params.x,
    y: params.y,
    width,
    height,
    rotation: 0,
    color,
    text: "",
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
    console.error("[createShape] insert error", {
      error: error.message,
      type: params.type,
      boardId,
    });
    return `Error: ${error.message}`;
  }
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId,
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });
  return `Created ${params.type} at (${params.x}, ${params.y}). Id: ${withMeta.id}`;
}
