import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import {
  DEFAULT_FRAME,
  MIN_FRAME_WIDTH,
  MIN_FRAME_HEIGHT,
} from "@/components/canvas/constants";
import { resolveColor } from "@/lib/ai/color-map";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function createFrame(
  ctx: ToolContext,
  params: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    color?: string;
  },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();
  const width = Math.max(MIN_FRAME_WIDTH, params.width ?? DEFAULT_FRAME.width);
  const height = Math.max(
    MIN_FRAME_HEIGHT,
    params.height ?? DEFAULT_FRAME.height,
  );

  const object: BoardObject = {
    id,
    type: "frame",
    parentId: null,
    clipContent: true,
    x: params.x,
    y: params.y,
    width,
    height,
    rotation: 0,
    color: params.color ? resolveColor(params.color) : "#E2E8F0",
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

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId,
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });

  return `Created frame at (${params.x}, ${params.y}). Id: ${withMeta.id}`;
}
