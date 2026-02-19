import type { ToolContext } from "./types";

export async function deleteObject(
  ctx: ToolContext,
  params: { objectId: string }
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;

  const { error } = await supabase
    .from("board_objects")
    .delete()
    .eq("id", params.objectId)
    .eq("board_id", boardId);

  if (error) return `Error: ${error.message}`;

  const updated_at = new Date().toISOString();
  broadcast({ op: "DELETE", id: params.objectId, updated_at });
  return `Deleted ${params.objectId}`;
}
