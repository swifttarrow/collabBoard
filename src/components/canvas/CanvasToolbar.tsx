"use client";

import { ChevronDown, MousePointer2, StickyNote, Square, Circle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ShapeTool = "rect" | "circle" | "line";
export type Tool = "select" | "sticky" | ShapeTool;

type CanvasToolbarProps = {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
};

const SHAPE_ITEMS: { tool: ShapeTool; label: string; icon: React.ReactNode }[] = [
  { tool: "rect", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
  { tool: "circle", label: "Circle", icon: <Circle className="h-4 w-4" /> },
  { tool: "line", label: "Line", icon: <Minus className="h-4 w-4" /> },
];

function getShapeLabel(tool: ShapeTool): string {
  return SHAPE_ITEMS.find((i) => i.tool === tool)?.label ?? "Rectangle";
}

function getShapeIcon(tool: ShapeTool): React.ReactNode {
  return SHAPE_ITEMS.find((i) => i.tool === tool)?.icon ?? <Square className="h-4 w-4" />;
}

export function CanvasToolbar({ activeTool, onSelectTool }: CanvasToolbarProps) {
  const isShapeTool = (t: Tool): t is ShapeTool => t === "rect" || t === "circle" || t === "line";
  const currentShape = isShapeTool(activeTool) ? activeTool : "rect";

  return (
    <div className="absolute left-6 top-6 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/20 bg-slate-900/80 px-4 py-3 text-slate-200 pointer-events-none [&>div]:pointer-events-auto">
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
      <div className="group relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Shapes"
              className={cn(
                "flex h-9 items-center gap-0 rounded-full border pl-0.5 pr-1.5 py-0.5 transition",
                isShapeTool(activeTool)
                  ? "border-slate-100/60 bg-slate-200 text-slate-900"
                  : "border-slate-200/20 bg-slate-900/70 text-slate-100 hover:border-slate-100/50"
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {getShapeIcon(currentShape)}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px] border-slate-700 bg-slate-900">
            {SHAPE_ITEMS.map(({ tool, label, icon }) => (
              <DropdownMenuItem
                key={tool}
                onClick={() => onSelectTool(tool)}
                className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
          {getShapeLabel(currentShape)}
        </span>
      </div>
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
