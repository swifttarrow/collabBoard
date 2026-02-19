import type { ToolContext } from "./types";

/**
 * Lightweight tool that returns only stickyCount. Use for create-stickies flows
 * instead of getBoardState when the board has many objects—getBoardState returns
 * the full object list (can be 60K+ chars) which can hit token limits.
 */
export async function getStickyCount(ctx: ToolContext): Promise<string> {
  console.log("[getStickyCount] called", { boardId: ctx.boardId });
  const { boardId, supabase } = ctx;
  const { count, error } = await supabase
    .from("board_objects")
    .select("*", { count: "exact", head: true })
    .eq("board_id", boardId)
    .eq("type", "sticky");

  if (error) {
    console.error("[getStickyCount] error:", error);
    return JSON.stringify({ stickyCount: 0, error: error.message });
  }
  const result = JSON.stringify({ stickyCount: count ?? 0 });
  console.log("[getStickyCount] returning", { stickyCount: count ?? 0 });
  return result;
}
