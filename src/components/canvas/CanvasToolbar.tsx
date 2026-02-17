"use client";

import { MousePointer2, StickyNote, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "sticky" | "rect";

type CanvasToolbarProps = {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
};

export function CanvasToolbar({ activeTool, onSelectTool }: CanvasToolbarProps) {
  return (
    <div className="absolute left-6 top-6 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/20 bg-slate-900/80 px-4 py-3 text-slate-200">
      <ToolButton
        active={activeTool === "select"}
        label="Select"
        onClick={() => onSelectTool("select")}
      >
        <MousePointer2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={activeTool === "sticky"}
        label="Sticky"
        onClick={() => onSelectTool("sticky")}
      >
        <StickyNote className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={activeTool === "rect"}
        label="Rectangle"
        onClick={() => onSelectTool("rect")}
      >
        <Square className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

type ToolButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({ active, label, onClick, children }: ToolButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border text-slate-100 transition",
          active
            ? "border-slate-100/60 bg-slate-200 text-slate-900"
            : "border-slate-200/20 bg-slate-900/70 hover:border-slate-100/50"
        )}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
