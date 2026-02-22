/**
 * Record a save checkpoint at the board's current revision.
 * Used to show "Saved" markers in the version history panel.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { assertBoardAccess } from "@/lib/auth/board-access";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boardId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await assertBoardAccess(supabase, boardId, user.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 404 ? "Board not found" : "Access denied" },
      { status: access.status }
    );
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("revision")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return NextResponse.json(
      { error: boardError?.message ?? "Board not found" },
      { status: 404 }
    );
  }

  const { error: insertError } = await supabase.from("board_saves").insert({
    board_id: boardId,
    server_revision: board.revision,
    user_id: user.id,
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    serverRevision: board.revision,
  });
}
