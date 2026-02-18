import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BoardLayout } from "./BoardLayout";
import { getRandomAvatarColor } from "@/lib/avatar-colors";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

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
    .select("id, first_name, last_name, avatar_color")
    .in("id", memberIdsList);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { first_name: p.first_name, last_name: p.last_name, avatar_color: p.avatar_color },
    ])
  );
  const members = memberIdsList.map((userId) => ({
    id: userId,
    first_name: profileMap.get(userId)?.first_name ?? null,
    last_name: profileMap.get(userId)?.last_name ?? null,
    avatar_color: profileMap.get(userId)?.avatar_color ?? null,
  }));

  const currentUserProfile = user ? profileMap.get(user.id) : null;

  // Ensure current user has an avatar color (assign on first load if missing)
  if (user && currentUserProfile && !currentUserProfile.avatar_color) {
    const color = getRandomAvatarColor();
    await supabase.from("profiles").update({ avatar_color: color }).eq("id", user.id);
    currentUserProfile.avatar_color = color;
  }

  return (
    <BoardLayout
      boardId={id}
      boardTitle={board.title}
      members={members}
      user={
        user
          ? {
              id: user.id,
              email: user.email ?? "",
              firstName: currentUserProfile?.first_name,
              lastName: currentUserProfile?.last_name,
              avatarColor: currentUserProfile?.avatar_color,
            }
          : null
      }
    />
  );
}
