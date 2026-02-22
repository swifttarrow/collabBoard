import type { BoardObjectRow } from "@/lib/board/sync";
import { rowToObject } from "@/lib/board/sync";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export async function getBoardState(ctx: ToolContext): Promise<string> {
  console.log("[getBoardState] called", { boardId: ctx.boardId });
  const { boardId, supabase } = ctx;
  const { data: rows, error } = await supabase
    .from("board_objects")
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
    )
    .eq("board_id", boardId)
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("[getBoardState] error:", error);
    return `Error loading board: ${error.message}`;
  }

  console.log("[getBoardState] rows loaded", { count: (rows ?? []).length });

  for (const key of Object.keys(ctx.objects)) delete ctx.objects[key];
  for (const row of rows ?? []) {
    const withMeta = toObjectWithMeta(
      row as BoardObjectRow & { updated_at: string },
      boardId,
    );
    ctx.objects[withMeta.id] = withMeta;
  }

  const list = (rows ?? []).map((r) => {
    const o = rowToObject(r as Parameters<typeof rowToObject>[0]);
    return {
      id: o.id,
      type: o.type,
      text: o.text,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      color: o.color,
    };
  });
  const stickyCount = list.filter((o) => o.type === "sticky").length;
  const objectsWithParent = (rows ?? []).map((r) => ({
    id: (r as BoardObjectRow).id,
    type: (r as BoardObjectRow).type,
    parent_id: (r as BoardObjectRow).parent_id,
  }));
  console.log("[getBoardState] returning", {
    boardId,
    stickyCount,
    objectCount: list.length,
    objectsWithParent,
  });

  return JSON.stringify({ stickyCount, objects: list }, null, 2);
}
