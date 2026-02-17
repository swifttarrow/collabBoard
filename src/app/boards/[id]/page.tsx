import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CanvasBoardClient } from "@/components/CanvasBoardClient";
import { InviteButton } from "./InviteButton";

type Props = { params: Promise<{ id: string }> };

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-join: add authenticated user as member so they can access the board.
  if (user) {
    await supabase.rpc("join_board_direct", { p_board_id: id });
  }

  const { data: board, error } = await supabase
    .from("boards")
    .select("id, title, owner_id")
    .eq("id", id)
    .single();

  if (error || !board) {
    notFound();
  }

  const isOwner = user?.id === board.owner_id;

  // Fetch all board members: owner + board_members, with profiles for avatars
  const memberIds = new Set<string>([board.owner_id]);
  const { data: boardMembers } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", id);
  for (const m of boardMembers ?? []) {
    memberIds.add(m.user_id);
  }
  const memberIdsList = Array.from(memberIds);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", memberIdsList);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { first_name: p.first_name, last_name: p.last_name }])
  );
  const members = memberIdsList.map((userId) => ({
    id: userId,
    first_name: profileMap.get(userId)?.first_name ?? null,
    last_name: profileMap.get(userId)?.last_name ?? null,
  }));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <Link
          href="/boards"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Boards
        </Link>
        <span className="flex-1 text-sm text-slate-500">{board.title}</span>
        <Link
          href="/profile"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          Profile
        </Link>
        {isOwner && <InviteButton boardId={id} />}
      </header>
      <div className="min-h-0 flex-1">
        <CanvasBoardClient boardId={id} members={members} />
      </div>
    </div>
  );
}
