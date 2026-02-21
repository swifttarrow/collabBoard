"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Unlink, ArrowRight, Circle } from "lucide-react";
import type { ViewportState } from "@/lib/board/types";
import { cn } from "@/lib/utils";

const EDGE_PADDING = 8;

type EndpointContextMenuProps = {
  lineId: string;
  anchor: "start" | "end";
  anchorPosition: { x: number; y: number };
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  hasAttachment: boolean;
  currentCap: "arrow" | "point";
  onBreakConnection: () => void;
  onSetCap: (cap: "arrow" | "point") => void;
  onClose: () => void;
};

export function EndpointContextMenu({
  lineId: _lineId,
  anchor,
  anchorPosition,
  viewport,
  stageWidth,
  stageHeight,
  hasAttachment,
  currentCap,
  onBreakConnection,
  onSetCap,
  onClose,
}: EndpointContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + anchorPosition.x * scale;
  const top = vy + anchorPosition.y * scale;

  useLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const menuRect = menuEl.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (menuRect.right > window.innerWidth - EDGE_PADDING)
      dx = window.innerWidth - EDGE_PADDING - menuRect.right;
    if (menuRect.left < EDGE_PADDING) dx = EDGE_PADDING - menuRect.left;
    if (menuRect.bottom > window.innerHeight - EDGE_PADDING)
      dy = window.innerHeight - EDGE_PADDING - menuRect.bottom;
    if (menuRect.top < EDGE_PADDING) dy = EDGE_PADDING - menuRect.top;

    setAdjust({ x: dx, y: dy });
  }, [left, top]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const label = anchor === "start" ? "Left" : "Right";

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-40"
      style={{ width: stageWidth, height: stageHeight }}
    >
      <div
        ref={menuRef}
        className="absolute min-w-[160px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        style={{
          left: Math.round(left),
          top: Math.round(top),
          transform: `translate(${adjust.x}px, ${adjust.y}px)`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {hasAttachment && (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              onBreakConnection();
              onClose();
            }}
          >
            <Unlink className="h-3.5 w-3.5 text-slate-500" />
            Break connection
          </button>
        )}
        <div className="px-2 py-1 text-[10px] font-medium text-slate-400">
          {label} endpoint
        </div>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100",
            currentCap === "arrow" && "bg-slate-100 font-medium"
          )}
          onClick={() => {
            onSetCap("arrow");
            onClose();
          }}
        >
          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          Arrow
        </button>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100",
            currentCap === "point" && "bg-slate-100 font-medium"
          )}
          onClick={() => {
            onSetCap("point");
            onClose();
          }}
        >
          <Circle className="h-2.5 w-2.5 text-slate-500" />
          Point
        </button>
      </div>
    </div>
  );
}
