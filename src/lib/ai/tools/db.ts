import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { rowToObject } from "@/lib/board/sync";
import type { BoardObjectRow } from "@/lib/board/sync";

export function toObjectWithMeta(
  row: BoardObjectRow & { updated_at: string },
  boardId: string
): BoardObjectWithMeta {
  const obj = rowToObject(row as Parameters<typeof rowToObject>[0]);
  return { ...obj, _updatedAt: row.updated_at, board_id: boardId };
}

export async function fetchObject(
  supabase: SupabaseClient,
  boardId: string,
  objectId: string
): Promise<BoardObjectWithMeta | null> {
  const { data: row, error } = await supabase
    .from("board_objects")
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .eq("board_id", boardId)
    .eq("id", objectId)
    .maybeSingle();
  if (error || !row) return null;
  return toObjectWithMeta(row as BoardObjectRow & { updated_at: string }, boardId);
}
