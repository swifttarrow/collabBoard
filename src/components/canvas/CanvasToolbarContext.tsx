"use client";

import { createContext, useContext, useState } from "react";
import type { Tool, LineStyle } from "./CanvasToolbar";

type CanvasToolbarContextValue = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  lineStyle: LineStyle;
  setLineStyle: (style: LineStyle) => void;
};

const CanvasToolbarContext = createContext<CanvasToolbarContextValue | null>(null);

export function CanvasToolbarProvider({ children }: { children: React.ReactNode }) {
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [lineStyle, setLineStyle] = useState<LineStyle>("right");
  return (
    <CanvasToolbarContext.Provider
      value={{
        activeTool,
        setActiveTool,
        lineStyle,
        setLineStyle,
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
