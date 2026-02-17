import Link from "next/link";

export default function Home() {
  return (
    <div className="grid min-h-screen place-items-center">
      <main className="max-w-[560px] p-6 text-center">
        <div className="text-xs uppercase tracking-[0.25em] opacity-70">
          COLLABBOARD
        </div>
        <h1 className="my-4 text-[40px]">
          A real-time collaborative whiteboard.
        </h1>
        <p className="text-lg opacity-80">
          Start building the MVP: realtime sync, cursors, and AI commands.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/canvas"
            className="rounded-full bg-slate-200 px-[18px] py-[10px] text-sm font-semibold text-slate-900"
          >
            Open Canvas
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-200/30 px-[18px] py-[10px] text-sm font-semibold"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
