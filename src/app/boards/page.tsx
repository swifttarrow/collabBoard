import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewBoardButton } from "./NewBoardButton";
import { BoardsPageContent } from "./BoardsPageContent";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [boardsResult, membersResult] = await Promise.all([
    supabase
      .from("boards")
      .select("id, title, created_at, owner_id")
      .order("created_at", { ascending: false }),
    supabase.from("board_members").select("board_id").eq("user_id", user.id),
  ]);

  const { data: boards, error } = boardsResult;
  const { data: memberships } = membersResult;

  const memberBoardIds = new Set([
    ...(memberships ?? []).map((m) => m.board_id),
    ...(boards ?? []).filter((b) => b.owner_id === user.id).map((b) => b.id),
  ]);

  const allBoardsWithMembership = (boards ?? []).map((board) => ({
    id: board.id,
    title: board.title,
    created_at: board.created_at,
    isMember: memberBoardIds.has(board.id),
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-slate-500 underline hover:text-slate-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Boards</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/join"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Join board
            </Link>
            <NewBoardButton />
          </div>
        </div>

        <BoardsPageContent
          allBoards={allBoardsWithMembership}
          error={error?.message ?? null}
        />
      </main>
    </div>
  );
}
