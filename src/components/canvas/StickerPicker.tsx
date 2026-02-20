"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const UNDRAW_CDN = "https://cdn.jsdelivr.net/npm/undraw-svg@1.0.0";
const ILLUSTRATIONS_URL = `${UNDRAW_CDN}/illustrations.json`;

type UndrawEntry = {
  slug: string;
  title: string;
  keywords?: string[];
};

function searchIllustrations(query: string, items: UndrawEntry[]): UndrawEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, 120);
  const words = q.split(/\s+/).filter(Boolean);
  return items.filter((e) => {
    const title = (e.title ?? "").toLowerCase();
    const keywords = (e.keywords ?? []).join(" ").toLowerCase();
    const text = `${title} ${keywords}`;
    return words.every((w) => text.includes(w));
  }).slice(0, 120);
}

export type StickerPickerProps = {
  onSelect: (slug: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
};

export function StickerPicker({
  onSelect,
  onOpenChange,
  className,
  children,
}: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [illustrations, setIllustrations] = useState<UndrawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(ILLUSTRATIONS_URL)
      .then((res) => res.json())
      .then((data: UndrawEntry[]) => {
        if (!cancelled) {
          setIllustrations(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stickers");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => searchIllustrations(query, illustrations),
    [query, illustrations]
  );

  const handleSelect = useCallback(
    (slug: string) => {
      onSelect(slug);
      setOpen(false);
      setQuery("");
      onOpenChange?.(false);
    },
    [onSelect, onOpenChange]
  );

  return (
    <div className={cn("relative", className)}>
      <div
        onClick={() => {
          const next = !open;
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        {children}
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            aria-hidden
            onClick={() => {
              setOpen(false);
              onOpenChange?.(false);
            }}
          />
          <div
            className="absolute left-0 top-full z-[110] mt-2 w-[340px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
            role="dialog"
            aria-label="Sticker picker"
          >
            <div className="border-b border-slate-700 p-2">
              <div className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search illustrations..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  Loading...
                </div>
              ) : error ? (
                <div className="flex h-32 items-center justify-center text-sm text-red-400">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  No illustrations found
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filtered.map((e) => (
                    <button
                      key={e.slug}
                      type="button"
                      onClick={() => handleSelect(e.slug)}
                      className="flex flex-col items-center gap-0.5 rounded-md p-2 transition hover:bg-slate-700 focus:bg-slate-700 focus:outline-none"
                      title={e.title}
                    >
                      <img
                        src={`${UNDRAW_CDN}/svgs/${e.slug}.svg`}
                        alt={e.title}
                        className="h-12 w-12 object-contain"
                        loading="lazy"
                        draggable={false}
                      />
                      <span className="truncate w-full text-center text-[10px] text-slate-400">
                        {e.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-700 px-3 py-2 text-[10px] text-slate-500">
              Illustrations by{" "}
              <a
                href="https://undraw.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:underline"
              >
                unDraw
              </a>{" "}
              (Katerina Limpitsouni)
            </div>
          </div>
        </>
      )}
    </div>
  );
}
