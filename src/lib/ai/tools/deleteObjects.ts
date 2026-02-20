import type { ToolContext } from "./types";

const DELETE_OBJECTS_MAX = 25;

export async function deleteObjects(
  ctx: ToolContext,
  params: { objectIds: string[] },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const ids = params.objectIds.filter(Boolean).slice(0, DELETE_OBJECTS_MAX);
  if (ids.length === 0) return "No objects to delete.";
  const omitted = params.objectIds.filter(Boolean).length - ids.length;
  const omittedMsg =
    omitted > 0
      ? ` (capped at ${DELETE_OBJECTS_MAX}; ${omitted} not deleted)`
      : "";

  const { error } = await supabase
    .from("board_objects")
    .delete()
    .eq("board_id", boardId)
    .in("id", ids);

  if (error) return `Error: ${error.message}`;

  const updated_at = new Date().toISOString();
  for (const id of ids) {
    broadcast({ op: "DELETE", id, updated_at });
  }
  return `Deleted ${ids.length} object(s)${omittedMsg}.`;
}
