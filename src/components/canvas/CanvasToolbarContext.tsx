"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Tool, ShapeTool } from "./CanvasToolbar";

type CanvasToolbarContextValue = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  /** Last selected shape tool; used when activeTool is select to show/preserve shape choice */
  lastShapeTool: ShapeTool;
  perfEnabled: boolean;
  setPerfEnabled: (enabled: boolean) => void;
  /** When set, next canvas click places a sticker with this unDraw slug */
  pendingStickerSlug: string | null;
  setPendingStickerSlug: (slug: string | null) => void;
};

const CanvasToolbarContext = createContext<CanvasToolbarContextValue | null>(null);

const SHAPE_TOOLS: ShapeTool[] = ["rect", "circle", "line", "connector"];

export function CanvasToolbarProvider({ children }: { children: React.ReactNode }) {
  const [activeTool, setActiveToolState] = useState<Tool>("select");
  const [lastShapeTool, setLastShapeTool] = useState<ShapeTool>("rect");
  const [perfEnabled, setPerfEnabled] = useState(false);
  const [pendingStickerSlug, setPendingStickerSlug] = useState<string | null>(null);

  const setActiveTool = useCallback((tool: Tool) => {
    setActiveToolState(tool);
    if (SHAPE_TOOLS.includes(tool as ShapeTool)) {
      setLastShapeTool(tool as ShapeTool);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setPerfEnabled((prev) => !prev);
      }
      if (e.key === "Escape") {
        setPendingStickerSlug(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CanvasToolbarContext.Provider
      value={{
        activeTool,
        setActiveTool,
        lastShapeTool,
        perfEnabled,
        setPerfEnabled,
        pendingStickerSlug,
        setPendingStickerSlug,
      }}
    >
      {children}
    </CanvasToolbarContext.Provider>
  );
}

export function useCanvasToolbar() {
  const ctx = useContext(CanvasToolbarContext);
  if (!ctx) throw new Error("useCanvasToolbar must be used within CanvasToolbarProvider");
  return ctx;
}
