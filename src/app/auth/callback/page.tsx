"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/boards";

    if (!code) {
      setStatus("error");
      window.location.replace("/login?error=auth");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setStatus("error");
          window.location.replace("/login?error=auth");
          return;
        }
        window.location.replace(next);
      })
      .catch(() => {
        setStatus("error");
        window.location.replace("/login?error=auth");
      });
  }, [searchParams]);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50">
      <p className="text-slate-600">
        {status === "loading" ? "Signing you in…" : "Redirecting…"}
      </p>
    </div>
  );
}
