import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinBoardForm } from "./JoinBoardForm";

type Props = { searchParams: Promise<{ code?: string }> };

export default async function JoinBoardPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { code } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50">
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"
        aria-hidden
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
        <header className="absolute left-0 right-0 top-0 flex h-14 items-center justify-between px-4">
          <Link
            href="/boards"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Boards
          </Link>
        </header>

        <main className="w-full max-w-sm">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-6 shadow-lg backdrop-blur-sm">
            <h1 className="text-xl font-semibold text-slate-900">
              Join a board
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter the invite code shared with you to collaborate on a board.
            </p>
            <JoinBoardForm initialCode={code} />
          </div>
        </main>
      </div>
    </div>
  );
}
