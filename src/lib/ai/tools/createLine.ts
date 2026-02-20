import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

/**
 * Create a line with free endpoints (e.g. for axis arrows).
 * Uses straight routing by default.
 */
export async function createLine(
  ctx: ToolContext,
  params: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startCap?: "arrow" | "point";
    endCap?: "arrow" | "point";
    routingMode?: "straight" | "orthogonal" | "curved";
    strokeWidth?: number;
    color?: string;
  },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();

  const object: BoardObject = {
    id,
    type: "line",
    parentId: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    color: params.color ?? "#64748b",
    text: "",
    data: {
      start: { type: "free", x: params.startX, y: params.startY },
      end: { type: "free", x: params.endX, y: params.endY },
      startCap: params.startCap ?? "point",
      endCap: params.endCap ?? "arrow",
      routingMode: params.routingMode ?? "straight",
      strokeWidth: params.strokeWidth ?? 2,
    },
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
  return `Created line from (${params.startX}, ${params.startY}) to (${params.endX}, ${params.endY}). Id: ${withMeta.id}`;
}
