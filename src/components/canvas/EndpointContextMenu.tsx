"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Unlink, ArrowRight, Circle, ChevronRight } from "lucide-react";
import type { ViewportState } from "@/lib/board/types";
import { cn } from "@/lib/utils";

const EDGE_PADDING = 8;
const SUBMENU_OVERLAP = 8;
const SUBMENU_EST_WIDTH = 100;

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
  anchor: _anchor,
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
  const [endpointStyleSubmenuOpen, setEndpointStyleSubmenuOpen] = useState(false);
  const [submenuLeft, setSubmenuLeft] = useState(false);
  const [containerOffset, setContainerOffset] = useState({ left: 0, top: 0 });

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + anchorPosition.x * scale;
  const top = vy + anchorPosition.y * scale;

  useLayoutEffect(() => {
    const el = document.getElementById("canvas-container");
    if (el) {
      const rect = el.getBoundingClientRect();
      setContainerOffset({ left: rect.left, top: rect.top });
    }
  }, []);

  useLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const menuRect = menuEl.getBoundingClientRect();
    const estMaxRight = Math.max(menuRect.right, menuRect.right + SUBMENU_EST_WIDTH - SUBMENU_OVERLAP);
    let dx = 0;
    let dy = 0;
    if (estMaxRight > window.innerWidth - EDGE_PADDING)
      dx = window.innerWidth - EDGE_PADDING - estMaxRight;
    if (menuRect.left < EDGE_PADDING) dx = EDGE_PADDING - menuRect.left;
    if (menuRect.bottom > window.innerHeight - EDGE_PADDING)
      dy = window.innerHeight - EDGE_PADDING - menuRect.bottom;
    if (menuRect.top < EDGE_PADDING) dy = EDGE_PADDING - menuRect.top;

    const newAdjust = { x: dx, y: dy };
    const newSubmenuLeft = menuRect.right + SUBMENU_EST_WIDTH > window.innerWidth - EDGE_PADDING;
    queueMicrotask(() => {
      setAdjust(newAdjust);
      setSubmenuLeft(newSubmenuLeft);
    });
  }, [left, top, containerOffset.left, containerOffset.top]);

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

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
      style={{
        left: Math.round(containerOffset.left + left),
        top: Math.round(containerOffset.top + top),
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
        <div
          className="relative"
          onMouseEnter={() => setEndpointStyleSubmenuOpen(true)}
          onMouseLeave={() => setEndpointStyleSubmenuOpen(false)}
        >
          <div
            className={cn(
              "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition",
              endpointStyleSubmenuOpen && "bg-slate-100"
            )}
          >
            <span className="flex items-center gap-2">
              {/* Line-dot-left-horizontal: horizontal line with dot at left end */}
              <svg
                className="h-3.5 w-3.5 shrink-0 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="4" cy="12" r="2" fill="currentColor" />
                <path d="M10 12h10" />
              </svg>
              Endpoint style
            </span>
            <ChevronRight
              className={cn(
                "h-3 w-3 text-slate-400 transition-transform",
                submenuLeft && "rotate-180"
              )}
            />
          </div>
          {endpointStyleSubmenuOpen && (
            <div
              className="absolute top-0 z-50 min-w-[100px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              style={
                submenuLeft
                  ? { right: "100%", marginRight: -SUBMENU_OVERLAP }
                  : { left: "100%", marginLeft: -SUBMENU_OVERLAP }
              }
              onMouseEnter={() => setEndpointStyleSubmenuOpen(true)}
              onMouseLeave={() => setEndpointStyleSubmenuOpen(false)}
            >
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                  currentCap === "arrow" && "bg-slate-100 font-medium"
                )}
                onClick={() => {
                  onSetCap("arrow");
                  setEndpointStyleSubmenuOpen(false);
                  onClose();
                }}
              >
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                Arrow
              </button>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                  currentCap === "point" && "bg-slate-100 font-medium"
                )}
                onClick={() => {
                  onSetCap("point");
                  setEndpointStyleSubmenuOpen(false);
                  onClose();
                }}
              >
                <Circle className="h-2.5 w-2.5 text-slate-500" />
                Point
              </button>
            </div>
          )}
        </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}
