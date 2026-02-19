"use client";

import { useState, useEffect } from "react";

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

export type CanvasDimensions = { width: number; height: number };

/**
 * Returns canvas dimensions that track window size.
 * Used when the canvas fills the viewport (e.g. flex-1 container).
 */
export function useCanvasDimensions(): CanvasDimensions {
  const [dimensions, setDimensions] = useState<CanvasDimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return dimensions;
}
