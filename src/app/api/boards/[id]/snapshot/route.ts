/**
 * Resilient Canvas: Fetch latest board snapshot + server revision.
 * Used on startup and for rebase when reconnecting.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rowToObject } from "@/lib/board/sync";
import type { BoardObjectRow } from "@/lib/board/sync";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boardId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("revision")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return NextResponse.json(
      { error: boardError?.message || "Board not found" },
      { status: 404 }
    );
  }

  const { data: rows, error: objectsError } = await supabase
    .from("board_objects")
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by"
    )
    .eq("board_id", boardId)
    .order("updated_at", { ascending: true });

  if (objectsError) {
    return NextResponse.json(
      { error: objectsError.message },
      { status: 500 }
    );
  }

  const objects: Record<string, ReturnType<typeof rowToObject>> = {};
  for (const row of rows ?? []) {
    const obj = rowToObject(row as BoardObjectRow);
    objects[obj.id] = obj;
  }

  const revision = (board as { revision?: number }).revision ?? 0;

  return NextResponse.json({
    objects,
    revision,
    timestamp: Date.now(),
  });
}
