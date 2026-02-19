"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Tool, LineStyle } from "./CanvasToolbar";

type CanvasToolbarContextValue = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  lineStyle: LineStyle;
  setLineStyle: (style: LineStyle) => void;
  perfEnabled: boolean;
  setPerfEnabled: (enabled: boolean) => void;
};

const CanvasToolbarContext = createContext<CanvasToolbarContextValue | null>(null);

export function CanvasToolbarProvider({ children }: { children: React.ReactNode }) {
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [lineStyle, setLineStyle] = useState<LineStyle>("right");
  const [perfEnabled, setPerfEnabled] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setPerfEnabled((prev) => !prev);
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
        lineStyle,
        setLineStyle,
        perfEnabled,
        setPerfEnabled,
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
