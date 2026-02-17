"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const authError = searchParams.get("error");
  const next = searchParams.get("next") ?? "/boards";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  const isLocalSupabase =
    typeof window !== "undefined" &&
    (window.location.origin.includes("localhost") ||
      window.location.origin.includes("127.0.0.1"));

  const backdrop = (
    <>
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
    </>
  );

  if (sent) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50">
        {backdrop}
        <div className="relative grid min-h-screen place-items-center p-4">
        <main className="max-w-[400px] rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Check your inbox
          </div>
          <p className="mt-3 text-slate-700">
            We sent a sign-in link to <strong>{email}</strong>. Click the link to
            sign in.
          </p>
          {isLocalSupabase && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-900">
              <strong>Local Supabase:</strong> Emails aren’t sent to real
              inboxes. Open{" "}
              <a
                href="http://127.0.0.1:54324"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Inbucket (port 54324)
              </a>{" "}
              to see the magic link for <strong>{email}</strong>.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            You can close this tab after signing in.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Back to home</Link>
          </Button>
        </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50">
      {backdrop}
      <div className="relative grid min-h-screen place-items-center p-4">
      <main className="w-full max-w-[400px] rounded-xl border border-slate-200/60 bg-white p-8 shadow-sm">
        <div className="text-xs uppercase tracking-[0.25em] opacity-70">
          COLLABBOARD
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we’ll send you a magic link.
        </p>

        {authError === "auth" && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Sign-in link invalid or expired. Request a new one below.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send magic link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="underline hover:text-slate-700">
            Back to home
          </Link>
        </p>
      </main>
      </div>
    </div>
  );
}
