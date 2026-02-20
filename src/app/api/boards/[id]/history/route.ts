/**
 * Board history: fetch applied ops with user info for cross-user history.
 * Used for version history panel with expandable milestones.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const { data: historyRows, error: historyError } = await supabase
    .from("board_history")
    .select("id, op_id, server_revision, op_type, payload, user_id, created_at")
    .eq("board_id", boardId)
    .order("server_revision", { ascending: true });

  if (historyError) {
    return NextResponse.json(
      { error: historyError.message },
      { status: 500 }
    );
  }

  const userIds = [...new Set((historyRows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const profiles: Record<string, { firstName: string | null; lastName: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);
    for (const p of profileRows ?? []) {
      profiles[p.id] = {
        firstName: p.first_name ?? null,
        lastName: p.last_name ?? null,
      };
    }
  }

  const { data: saveRows, error: savesError } = await supabase
    .from("board_saves")
    .select("id, board_id, server_revision, user_id, created_at")
    .eq("board_id", boardId)
    .order("server_revision", { ascending: true });

  if (savesError) {
    return NextResponse.json(
      { error: savesError.message },
      { status: 500 }
    );
  }

  const saveUserIds = [...new Set((saveRows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  for (const id of saveUserIds) {
    if (!profiles[id]) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", id)
        .maybeSingle();
      if (p) {
        profiles[id] = {
          firstName: p.first_name ?? null,
          lastName: p.last_name ?? null,
        };
      }
    }
  }

  const saves = (saveRows ?? []).map((row) => {
    const profile = row.user_id ? profiles[row.user_id] : null;
    const userName =
      row.user_id && profile
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unknown"
        : "Unknown";
    return {
      serverRevision: row.server_revision,
      userId: row.user_id,
      userName,
      createdAt: row.created_at,
    };
  });

  const entries = (historyRows ?? []).map((row) => ({
    id: row.op_id,
    serverRevision: row.server_revision,
    opType: row.op_type,
    payload: row.payload,
    userId: row.user_id,
    userName:
      row.user_id && profiles[row.user_id]
        ? [profiles[row.user_id].firstName, profiles[row.user_id].lastName]
            .filter(Boolean)
            .join(" ") || "Unknown"
        : "Unknown",
    createdAt: row.created_at,
  }));

  return NextResponse.json({ entries, saves });
}
