/**
 * Board access check for API routes.
 * Verifies user is board owner or a member. Defense-in-depth beyond RLS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type BoardAccessResult =
  | { ok: true }
  | { ok: false; status: 404 }
  | { ok: false; status: 403 };

/**
 * Verify the user has access to the board (owner or member).
 * Returns { ok: true } if allowed, or { ok: false, status } for error handling.
 */
export async function assertBoardAccess(
  supabase: SupabaseClient,
  boardId: string,
  userId: string
): Promise<BoardAccessResult> {
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return { ok: false, status: 404 };
  }

  if (board.owner_id === userId) {
    return { ok: true };
  }

  const { data: membership } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership) {
    return { ok: true };
  }

  return { ok: false, status: 403 };
}
