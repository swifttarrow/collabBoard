"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GuestSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGuestSignIn() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (err) {
      console.error("[GuestSignIn] signInAnonymously failed:", err);
      const isDisabled =
        err.message.toLowerCase().includes("anonymous sign-ins are disabled") ||
        err.message.toLowerCase().includes("anonymous sign-in");
      setError(
        isDisabled
          ? "Guest sign-in is not enabled. Please sign in with an account."
          : err.message
      );
      return;
    }
    router.push("/boards");
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleGuestSignIn}
        disabled={loading}
        className="rounded-full border-slate-300 bg-white px-[18px] py-[10px] text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
      >
        Continue as Guest
      </Button>
      {error && (
        <p className="max-w-[280px] text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
