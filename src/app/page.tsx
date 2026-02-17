import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50">
      {/* Soft blurred orbs for depth */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-slate-200/30 blur-3xl"
        aria-hidden
      />

      <div className="relative grid min-h-screen place-items-center">
        <main className="max-w-[560px] p-8 text-center">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-600">
            COLLABBOARD
          </div>
          <h1 className="my-4 text-[40px] font-semibold text-slate-900">
            A real-time collaborative whiteboard.
          </h1>
          <p className="text-lg text-slate-600">
            Start building the MVP: realtime sync, cursors, and AI commands.
          </p>
          <div className="flex justify-center gap-3">
          {user ? (
            <Link
              href="/boards"
              className="rounded-full bg-slate-900 px-[18px] py-[10px] text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              My Boards
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-slate-900 px-[18px] py-[10px] text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              Sign In
            </Link>
          )}
          {user && (
            <form action="/auth/signout" method="post" className="inline">
              <button
                type="submit"
                className="rounded-full border border-slate-300 bg-white/80 px-[18px] py-[10px] text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white hover:border-slate-400"
              >
                Sign Out
              </button>
            </form>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
