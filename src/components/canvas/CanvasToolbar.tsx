"use client";

import {
  ChevronDown,
  MousePointer2,
  StickyNote,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  PanelTop,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ShapeTool = "rect" | "circle";
export type Tool = "select" | "sticky" | "text" | "frame" | ShapeTool | "line";

export type LineCaps = { start: "arrow" | "point"; end: "arrow" | "point" };

export type LineStyle = "both" | "left" | "right" | "none";

type CanvasToolbarProps = {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  lineStyle: LineStyle;
  onLineStyleChange: (style: LineStyle) => void;
  perfEnabled: boolean;
  onPerfToggle: () => void;
};

export const LINE_STYLE_TO_CAPS: Record<LineStyle, LineCaps> = {
  both: { start: "arrow", end: "arrow" },
  left: { start: "arrow", end: "point" },
  right: { start: "point", end: "arrow" },
  none: { start: "point", end: "point" },
};

function getLineIcon(caps: LineCaps) {
  const cls = "h-4 w-4";
  if (caps.start === "arrow" && caps.end === "arrow") {
    return <ArrowRightLeft className={cls} />;
  }
  if (caps.start === "arrow" && caps.end === "point") {
    return <ArrowLeft className={cls} />;
  }
  if (caps.start === "point" && caps.end === "arrow") {
    return <ArrowRight className={cls} />;
  }
  return <Minus className={cls} />;
}

const SHAPE_ITEMS: { tool: ShapeTool; label: string; icon: React.ReactNode }[] = [
  { tool: "rect", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
  { tool: "circle", label: "Circle", icon: <Circle className="h-4 w-4" /> },
];

const LINE_ITEMS: { style: LineStyle; label: string; getIcon: () => React.ReactNode }[] = [
  { style: "both", label: "Double arrow", getIcon: () => getLineIcon(LINE_STYLE_TO_CAPS.both) },
  { style: "left", label: "Left arrow", getIcon: () => getLineIcon(LINE_STYLE_TO_CAPS.left) },
  { style: "right", label: "Right arrow", getIcon: () => getLineIcon(LINE_STYLE_TO_CAPS.right) },
  { style: "none", label: "No arrow", getIcon: () => getLineIcon(LINE_STYLE_TO_CAPS.none) },
];

function getShapeLabel(tool: ShapeTool): string {
  return SHAPE_ITEMS.find((i) => i.tool === tool)?.label ?? "Rectangle";
}

export function CanvasToolbar({
  activeTool,
  onSelectTool,
  lineStyle,
  onLineStyleChange,
  perfEnabled,
  onPerfToggle,
}: CanvasToolbarProps) {
  const isShapeTool = (t: Tool): t is ShapeTool => t === "rect" || t === "circle";
  const currentShape = isShapeTool(activeTool) ? activeTool : "rect";
  const lineCaps = LINE_STYLE_TO_CAPS[lineStyle];

  return (
    <div className="flex flex-row flex-nowrap items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 px-4 py-3 text-slate-200 backdrop-blur-md pointer-events-none [&>div]:pointer-events-auto">
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
        active={activeTool === "text"}
        label="Text"
        onClick={() => onSelectTool("text")}
      >
        <Type className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        active={activeTool === "frame"}
        label="Frame"
        onClick={() => onSelectTool("frame")}
      >
        <PanelTop className="h-4 w-4" />
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
                {SHAPE_ITEMS.find((i) => i.tool === currentShape)?.icon ?? <Square className="h-4 w-4" />}
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
      <div className="group relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Line"
              className={cn(
                "flex h-9 items-center gap-0 rounded-full border pl-0.5 pr-1.5 py-0.5 transition",
                activeTool === "line"
                  ? "border-slate-100/60 bg-slate-200 text-slate-900"
                  : "border-slate-200/20 bg-slate-900/70 text-slate-100 hover:border-slate-100/50"
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {getLineIcon(lineCaps)}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px] border-slate-700 bg-slate-900">
            {LINE_ITEMS.map(({ style, label, getIcon }) => (
              <DropdownMenuItem
                key={style}
                onClick={() => {
                  onLineStyleChange(style);
                  onSelectTool("line");
                }}
                className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
              >
                {getIcon()}
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
          Line
        </span>
      </div>
      <div className="ml-2 border-l border-slate-200/20 pl-2">
        <ToolButton
          active={perfEnabled}
          label="Performance metrics"
          onClick={onPerfToggle}
        >
          <Gauge className="h-4 w-4" />
        </ToolButton>
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
