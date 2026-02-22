"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
  "Enter",
] as const;

/**
 * Listens for the Konami code (↑↑↓↓←→←→BA + Enter) and invokes onComplete when matched.
 * Returns whether the easter egg was triggered (for showing UI).
 */
export function useKonamiCode() {
  const indexRef = useRef(0);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const expected = KONAMI_SEQUENCE[indexRef.current];
      const received =
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
          ? e.key
          : e.key.toLowerCase() === "enter"
            ? "Enter"
            : e.key.toLowerCase();

      if (received === expected) {
        indexRef.current++;
        if (indexRef.current === KONAMI_SEQUENCE.length) {
          setTriggered(true);
          indexRef.current = 0;
        }
      } else {
        indexRef.current = 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const reset = useCallback(() => setTriggered(false), []);

  return { triggered, reset };
}
