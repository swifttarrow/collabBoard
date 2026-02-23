"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const HEART_COUNT = 10;
const HEART_SIZE = 16;
const HEART_GAP = 2;
const CONTAINER_WIDTH = HEART_COUNT * HEART_SIZE + (HEART_COUNT - 1) * HEART_GAP;

const FILL_DURATION_MS = 240;
const STAGGER_MS = 96;
const FADE_DELAY_MS = 360;
const RUN_DURATION_MS = 3240; // Includes 2s fallen + shake + get up
const HEART_DISAPPEAR_MS = 80; // Quick "consume" pop when touched

// When character center touches each heart (ms into run). Computed from run keyframes.
const HEART_CONSUME_DELAYS_MS = [
  61, 112, 162, 212, 263, 2856, 2931, 3007, 3082, 3157,
];

type Phase = "filling" | "filled" | "fading";

type Props = {
  show: boolean;
  onComplete: () => void;
};

/** Contra-style pixel soldier (evocative 8-bit aesthetic, not a copy). */
function ContraRunner({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute top-1/2 z-10 shrink-0 origin-bottom", className)}
      style={{ width: 20, height: 20 }}
      aria-hidden
    >
      <div
        className="animate-konami-contra-bubble pointer-events-none absolute bottom-full left-1/2 mb-0.5 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
        style={{ transformOrigin: "center center" }}
      >
        ow
        <span
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white"
          aria-hidden
        />
      </div>
      <svg
        viewBox="0 0 20 20"
        className="animate-konami-contra-legs"
        style={{ width: 20, height: 20 }}
      >
        {/* Head - skin tone */}
        <rect x="6" y="2" width="8" height="6" fill="#f4c78c" />
        {/* Red headband */}
        <rect x="5" y="2" width="10" height="2" fill="#c41e3a" />
        {/* Body - green vest */}
        <rect x="5" y="8" width="10" height="8" fill="#2d5016" />
        <rect x="7" y="10" width="2" height="4" fill="#1a3009" />
        <rect x="11" y="10" width="2" height="4" fill="#1a3009" />
        {/* Legs - running */}
        <rect x="6" y="16" width="3" height="4" fill="#2d5016" />
        <rect x="11" y="16" width="3" height="4" fill="#2d5016" />
        {/* Gun */}
        <rect x="14" y="7" width="5" height="3" fill="#333" />
        <rect x="15" y="8" width="4" height="1" fill="#666" />
      </svg>
    </div>
  );
}

export function KonamiHearts({ show, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("filling");

  useEffect(() => {
    if (!show) return;

    const fillCompleteMs =
      (HEART_COUNT - 1) * STAGGER_MS + FILL_DURATION_MS;
    const fadeStartMs = fillCompleteMs + FADE_DELAY_MS;
    const totalMs = fadeStartMs + RUN_DURATION_MS;

    const fillDoneTimer = setTimeout(() => setPhase("filled"), fillCompleteMs);
    const fadeTimer = setTimeout(() => setPhase("fading"), fadeStartMs);
    const hideTimer = setTimeout(() => onComplete(), totalMs);

    return () => {
      clearTimeout(fillDoneTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div
      className="relative flex items-center gap-0.5"
      style={{ width: CONTAINER_WIDTH, minWidth: CONTAINER_WIDTH }}
    >
      {phase === "fading" && (
        <ContraRunner
          className="animate-konami-contra-run"
          key="runner"
        />
      )}
      {Array.from({ length: HEART_COUNT }, (_, i) => (
        <div
          key={i}
          className={cn(
            "relative",
            phase === "fading" && "animate-konami-heart-disappear"
          )}
          style={{
            width: HEART_SIZE,
            height: HEART_SIZE,
            ...(phase === "fading" && {
              animationDelay: `${HEART_CONSUME_DELAYS_MS[i]}ms`,
              animationDuration: `${HEART_DISAPPEAR_MS}ms`,
            }),
          }}
        >
          <Heart
            className="size-4 text-red-500"
            fill="none"
            stroke="currentColor"
          />
          <Heart
            className={cn(
              "absolute inset-0 size-4 text-red-500",
              phase === "filling" && "animate-konami-heart-fill"
            )}
            fill="currentColor"
            stroke="none"
            style={
              phase === "filling"
                ? { animationDelay: `${i * STAGGER_MS}ms` }
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
