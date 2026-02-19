import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewBoardButton } from "./NewBoardButton";
import { BoardsPageContent } from "./BoardsPageContent";
import { UserMenu } from "@/components/UserMenu";
import { getRandomAvatarColor } from "@/lib/avatar-colors";
import type { PreviewObject } from "@/components/board/BoardPreview";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [boardsResult, membersResult, profileResult, objectsResult] = await Promise.all([
    supabase
      .from("boards")
      .select("id, title, created_at, owner_id")
      .order("created_at", { ascending: false }),
    supabase.from("board_members").select("board_id").eq("user_id", user.id),
    supabase.from("profiles").select("first_name, last_name, avatar_color").eq("id", user.id).single(),
    supabase
      .from("board_objects")
      .select("id, board_id, type, parent_id, x, y, width, height, data, color, text")
      .order("updated_at", { ascending: false })
      .limit(2000),
  ]);

  const { data: boards, error } = boardsResult;
  const { data: objectRows } = objectsResult ?? {};
  const { data: memberships } = membersResult;
  const profile = profileResult.data;

  // Ensure user has an avatar color (assign on first load if missing)
  if (profile && !profile.avatar_color) {
    const color = getRandomAvatarColor();
    await supabase.from("profiles").update({ avatar_color: color }).eq("id", user.id);
    profile.avatar_color = color;
  }

  const memberBoardIds = new Set([
    ...(memberships ?? []).map((m) => m.board_id),
    ...(boards ?? []).filter((b) => b.owner_id === user.id).map((b) => b.id),
  ]);

  const PREVIEW_OBJECTS_PER_BOARD = 40;
  const previewByBoardId = new Map<string, PreviewObject[]>();
  for (const row of objectRows ?? []) {
    if ((row.parent_id ?? null) !== null) continue;
    const arr = previewByBoardId.get(row.board_id) ?? [];
    if (arr.length >= PREVIEW_OBJECTS_PER_BOARD) continue;
    arr.push({
      id: row.id,
      type: row.type,
      parentId: null,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      color: row.color ?? "#fef08a",
      text: row.text ?? "",
      data: row.data as Record<string, unknown> | undefined,
    });
    previewByBoardId.set(row.board_id, arr);
  }

  const allBoardsWithMembership = (boards ?? []).map((board) => ({
    id: board.id,
    title: board.title,
    created_at: board.created_at,
    isMember: memberBoardIds.has(board.id),
    previewObjects: previewByBoardId.get(board.id) ?? [],
  }));

  if (error) {
    console.error("boards fetch error", error.message, error.code, error.details);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/boards" className="text-sm font-semibold text-slate-900">
            COLLABBOARD
          </Link>
          <UserMenu
            email={user.email ?? ""}
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            avatarColor={profile?.avatar_color}
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Boards</h1>
          <NewBoardButton />
        </div>

        <BoardsPageContent
          allBoards={allBoardsWithMembership}
          error={error?.message ?? null}
        />
      </main>
    </div>
  );
}
