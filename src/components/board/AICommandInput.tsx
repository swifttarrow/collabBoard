"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  boardId: string;
  className?: string;
};

export function AICommandInput({ boardId, className }: Props) {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = command.trim();
      if (!trimmed || loading) return;

      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, command: trimmed }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          return;
        }

        setMessage(data.text ?? "Done.");
        setCommand("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    },
    [boardId, command, loading]
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Ask AI: Add a yellow sticky that says Hello..."
            disabled={loading}
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !command.trim()}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run
        </button>
      </form>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="text-xs text-slate-500" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
