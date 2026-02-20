import { rowToObject } from "@/lib/board/sync";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadObjects(
  supabase: SupabaseClient,
  boardId: string,
): Promise<Record<string, BoardObjectWithMeta>> {
  const { data: rows, error } = await supabase
    .from("board_objects")
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
    )
    .eq("board_id", boardId)
    .order("updated_at", { ascending: true });

  if (error) return {};
  const objects: Record<string, BoardObjectWithMeta> = {};
  for (const row of rows ?? []) {
    const obj = rowToObject(row as Parameters<typeof rowToObject>[0]);
    objects[obj.id] = obj;
  }
  return objects;
}
