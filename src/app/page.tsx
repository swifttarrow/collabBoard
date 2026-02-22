import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GuestSignInButton } from "@/components/GuestSignInButton";

export const dynamic = "force-dynamic";

const LANDING_STICKIES = [
  { text: "Ship it 🚀", color: "#FDE68A", top: "12%", left: "8%", rot: -6 },
  { text: "Real-time collab!", color: "#A5F3FC", top: "8%", right: "12%", rot: 4 },
  { text: "Ideas welcome", color: "#BBF7D0", top: "28%", left: "4%", rot: -3 },
  { text: "MVP first", color: "#FCA5A5", bottom: "32%", left: "6%", rot: 8 },
  { text: "AI-assisted ✨", color: "#F5D0FE", bottom: "28%", right: "8%", rot: -5 },
  { text: "Brainstorm → Build", color: "#FED7AA", top: "14%", left: "22%", rot: 2 },
  { text: "Draw here", color: "#E2E8F0", bottom: "18%", right: "14%", rot: 7 },
  { text: "Collab magic", color: "#A5F3FC", bottom: "14%", left: "14%", rot: -2 },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/boards");

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

      {/* Decorative stickies */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
        {LANDING_STICKIES.map((s, i) => (
          <div
            key={i}
            className="absolute w-[100px] px-2 py-2 text-center text-sm font-medium leading-tight text-slate-800 shadow-md sm:w-[110px]"
            style={{
              backgroundColor: s.color,
              borderRadius: "10px",
              transform: `rotate(${s.rot}deg)`,
              ...("top" in s && { top: s.top }),
              ...("bottom" in s && { bottom: s.bottom }),
              ...("left" in s && { left: s.left }),
              ...("right" in s && { right: s.right }),
            }}
          >
            {s.text}
          </div>
        ))}
      </div>

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
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/login"
              className="rounded-full bg-slate-900 px-[18px] py-[10px] text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              Sign In
            </Link>
            <GuestSignInButton />
          </div>
        </main>
      </div>
    </div>
  );
}
