"use client";

import { useState } from "react";
import {
  ChevronDown,
  Check,
  MousePointer2,
  StickyNote,
  Type,
  Square,
  Circle,
  Minus,
  Link2,
  PanelTop,
  Gauge,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StickerPicker } from "./StickerPicker";

export type ShapeTool = "rect" | "circle" | "line" | "connector";
export type Tool = "select" | "sticky" | "text" | "frame" | ShapeTool;

export type LineCaps = { start: "arrow" | "point"; end: "arrow" | "point" };

export type LineStyle = "both" | "left" | "right" | "none";

type CanvasToolbarProps = {
  activeTool: Tool;
  lastShapeTool: ShapeTool;
  onSelectTool: (tool: Tool) => void;
  perfEnabled: boolean;
  onPerfToggle: () => void;
  onSelectSticker?: (slug: string) => void;
  pendingStickerSlug?: string | null;
};

export const LINE_STYLE_TO_CAPS: Record<LineStyle, LineCaps> = {
  both: { start: "arrow", end: "arrow" },
  left: { start: "arrow", end: "point" },
  right: { start: "point", end: "arrow" },
  none: { start: "point", end: "point" },
};

const SHAPE_ITEMS: { tool: ShapeTool; label: string; icon: React.ReactNode }[] = [
  { tool: "rect", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
  { tool: "circle", label: "Circle", icon: <Circle className="h-4 w-4" /> },
  { tool: "line", label: "Line", icon: <Minus className="h-4 w-4" /> },
  { tool: "connector", label: "Connector", icon: <Link2 className="h-4 w-4" /> },
];

function getShapeLabel(tool: ShapeTool): string {
  return SHAPE_ITEMS.find((i) => i.tool === tool)?.label ?? "Rectangle";
}

type OpenDropdown = "shapes" | "sticker" | null;

export function CanvasToolbar({
  activeTool,
  lastShapeTool,
  onSelectTool,
  perfEnabled,
  onPerfToggle,
  onSelectSticker,
  pendingStickerSlug,
}: CanvasToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const isShapeTool = (t: Tool): t is ShapeTool =>
    t === "rect" || t === "circle" || t === "line" || t === "connector";
  const currentShape = isShapeTool(activeTool) ? activeTool : lastShapeTool;

  return (
    <div className="canvas-control-panel flex flex-row flex-nowrap items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/80 px-4 py-3 text-slate-200 backdrop-blur-md pointer-events-none [&>div]:pointer-events-auto">
      <ToolButton
        active={activeTool === "select" && !pendingStickerSlug}
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
      {onSelectSticker ? (
        <StickerPicker
          onSelect={onSelectSticker}
          open={openDropdown === "sticker"}
          onOpenChange={(open) => {
            setOpenDropdown(open ? "sticker" : null);
            if (!open) onSelectTool("select");
          }}
        >
          <div className="group relative">
            <button
              type="button"
              aria-label="Stickers"
              data-active={pendingStickerSlug ? "true" : "false"}
              className={cn(
                "canvas-control-button flex h-9 w-9 items-center justify-center rounded-full border text-slate-100 transition",
                pendingStickerSlug
                  ? "border-slate-100/60 bg-slate-200 text-slate-900"
                  : "border-slate-200/20 bg-slate-900/70 hover:border-slate-100/50"
              )}
            >
              <Smile className="h-4 w-4" />
            </button>
            <span className="canvas-control-tooltip pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
              Stickers
            </span>
          </div>
        </StickerPicker>
      ) : null}
      <ToolButton
        active={activeTool === "frame"}
        label="Frame"
        onClick={() => onSelectTool("frame")}
      >
        <PanelTop className="h-4 w-4" />
      </ToolButton>
      <div className="group relative flex">
        <button
          type="button"
          aria-label={getShapeLabel(currentShape)}
          data-active={isShapeTool(activeTool) ? "true" : "false"}
          onClick={() => onSelectTool(currentShape)}
          className={cn(
            "canvas-control-button flex h-9 w-9 shrink-0 items-center justify-center rounded-l-full border border-r-0 pl-0.5 pr-0 py-0.5 transition",
            isShapeTool(activeTool)
              ? "border-slate-100/60 bg-slate-200 text-slate-900"
              : "border-slate-200/20 bg-slate-900/70 text-slate-100 hover:border-slate-100/50"
          )}
        >
          {SHAPE_ITEMS.find((i) => i.tool === currentShape)?.icon ?? <Square className="h-4 w-4" />}
        </button>
        <DropdownMenu
          open={openDropdown === "shapes"}
          onOpenChange={(o) => setOpenDropdown(o ? "shapes" : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Switch shape"
              data-active={isShapeTool(activeTool) ? "true" : "false"}
              className={cn(
                "canvas-control-button flex h-9 w-6 shrink-0 items-center justify-center rounded-r-full border border-l-0 pr-1 pl-0.5 py-0.5 transition",
                isShapeTool(activeTool)
                  ? "border-slate-100/60 bg-slate-200 text-slate-900"
                  : "border-slate-200/20 bg-slate-900/70 text-slate-100 hover:border-slate-100/50"
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={16}
            className="canvas-control-menu min-w-[140px] border-slate-700 bg-slate-900"
          >
            {SHAPE_ITEMS.map(({ tool, label, icon }) => (
              <DropdownMenuItem
                key={tool}
                onClick={() => onSelectTool(tool)}
                className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
              >
                {icon}
                {label}
                {tool === currentShape && (
                  <Check className="ml-auto h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="canvas-control-tooltip pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
          {getShapeLabel(currentShape)}
        </span>
      </div>
      <div className="canvas-control-divider ml-2 border-l border-slate-200/20 pl-2">
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
        data-active={active ? "true" : "false"}
        className={cn(
          "canvas-control-button flex h-9 w-9 items-center justify-center rounded-full border text-slate-100 transition",
          active
            ? "border-slate-100/60 bg-slate-200 text-slate-900"
            : "border-slate-200/20 bg-slate-900/70 hover:border-slate-100/50"
        )}
      >
        {children}
      </button>
      <span className="canvas-control-tooltip pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
