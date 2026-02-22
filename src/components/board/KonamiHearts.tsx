"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const HEART_COUNT = 10;
const FILL_DURATION_MS = 240;  // 200 * 1.2
const STAGGER_MS = 96;        // 80 * 1.2
const FADE_DELAY_MS = 360;     // 300 * 1.2
const FADE_DURATION_MS = 600;  // 500 * 1.2

type Phase = "filling" | "filled" | "fading";

type Props = {
  show: boolean;
  onComplete: () => void;
};

export function KonamiHearts({ show, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("filling");

  useEffect(() => {
    if (!show) return;

    const fillCompleteMs =
      (HEART_COUNT - 1) * STAGGER_MS + FILL_DURATION_MS;
    const fadeStartMs = fillCompleteMs + FADE_DELAY_MS;
    const totalMs = fadeStartMs + FADE_DURATION_MS;

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
      className={cn(
        "flex items-center gap-0.5",
        phase === "fading" && "animate-konami-hearts-fade"
      )}
    >
      {Array.from({ length: HEART_COUNT }, (_, i) => (
        <div key={i} className="relative size-4">
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
