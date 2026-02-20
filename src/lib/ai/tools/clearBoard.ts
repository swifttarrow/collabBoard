import type { ToolContext } from "./types";

/**
 * Delete all objects on the board in one call. Use for "remove all", "clear board", "delete all objects".
 * No batching needed—more reliable than deleteObjects when clearing the entire board.
 */
export async function clearBoard(ctx: ToolContext): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;

  const { data: rows, error: selectError } = await supabase
    .from("board_objects")
    .select("id")
    .eq("board_id", boardId);

  if (selectError) return `Error: ${selectError.message}`;

  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) return "Board is already empty.";

  const { error: deleteError } = await supabase
    .from("board_objects")
    .delete()
    .eq("board_id", boardId);

  if (deleteError) return `Error: ${deleteError.message}`;

  const updated_at = new Date().toISOString();
  for (const id of ids) {
    broadcast({ op: "DELETE", id, updated_at });
  }

  for (const key of Object.keys(ctx.objects)) delete ctx.objects[key];

  return `Cleared board: deleted ${ids.length} object(s).`;
}
