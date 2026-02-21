"use client";

import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  zoomInPreset,
  zoomOutPreset,
  zoomToFit,
  setZoomPercent,
  resetZoom,
  ZOOM_PRESETS,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/viewport/tools";

type ZoomWidgetProps = {
  scale: number;
  stageWidth: number;
  stageHeight: number;
};

const PRESET_TOLERANCE = 1;

function formatZoomPercent(scale: number): string {
  const pct = scale * 100;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function ZoomWidget({
  scale,
  stageWidth,
  stageHeight,
}: ZoomWidgetProps) {
  const percent = scale * 100;
  const atMin = scale <= MIN_SCALE;
  const atMax = scale >= MAX_SCALE;

  const handleZoomIn = () => {
    if (!atMax) zoomInPreset(stageWidth, stageHeight);
  };

  const handleZoomOut = () => {
    if (!atMin) zoomOutPreset(stageWidth, stageHeight);
  };

  const handleFit = () => zoomToFit(stageWidth, stageHeight);

  const handlePreset = (pct: number) => () => {
    setZoomPercent(pct, stageWidth, stageHeight);
  };

  return (
    <div
      className="zoom-panel pointer-events-auto absolute right-4 top-4 z-[90] flex items-center gap-0.5 rounded-md border border-slate-700/50 bg-slate-900/80 px-1 py-1 text-slate-200 shadow-sm backdrop-blur-md [&_button]:text-slate-200 [&_button:hover]:bg-slate-800/80 [&_button:hover]:text-slate-100 [&_button:disabled]:text-slate-500 [&_button:disabled]:opacity-50"
      data-testid="zoom-widget"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleZoomOut}
        disabled={atMin}
        aria-label="Zoom out"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-[4rem] px-2 font-medium tabular-nums"
            aria-label="Zoom level"
          >
            {formatZoomPercent(scale)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="zoom-panel-menu min-w-[8rem] border-slate-700 bg-slate-900 text-slate-200">
          {ZOOM_PRESETS.map((pct) => {
            const isCurrent = Math.abs(percent - pct) <= PRESET_TOLERANCE;
            return (
              <DropdownMenuItem
                key={pct}
                onClick={handlePreset(pct)}
                className={isCurrent ? "bg-slate-800 text-slate-100" : "focus:bg-slate-800 focus:text-slate-100"}
              >
                {pct}%
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem onClick={handleFit} className="gap-2 focus:bg-slate-800 focus:text-slate-100">
            <Maximize2 className="h-4 w-4" />
            Zoom to fit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => resetZoom(stageWidth, stageHeight)}
            className="gap-2 focus:bg-slate-800 focus:text-slate-100"
          >
            Reset to 100%
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleZoomIn}
        disabled={atMax}
        aria-label="Zoom in"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
