import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewBoardButton } from "./NewBoardButton";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: boards, error } = await supabase
    .from("boards")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

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

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Couldn’t load boards</p>
            <p className="mt-1 text-amber-800">{error.message}</p>
            <p className="mt-2 text-xs text-amber-700">
              If the table is missing, run: <code className="rounded bg-amber-100 px-1">supabase db reset</code> or apply migrations.
            </p>
            <Link href="/boards" className="mt-3 inline-block text-sm font-medium underline">
              Try again
            </Link>
          </div>
        )}

        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(boards ?? []).map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                prefetch={false}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <span className="font-medium text-slate-900">{board.title}</span>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(board.created_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {!error && (boards ?? []).length === 0 && (
          <p className="mt-8 text-center text-slate-500">
            No boards yet. Create one above.
          </p>
        )}
      </main>
    </div>
  );
}
