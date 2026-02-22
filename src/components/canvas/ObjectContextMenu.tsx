"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Palette,
  Minus,
  Copy,
  Trash2,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { ViewportState } from "@/lib/board/types";
import { COLOR_PRESETS, COLOR_PRESET_LABELS } from "./constants";
import { cn } from "@/lib/utils";

const SUBMENU_OVERLAP = 8;
const EDGE_PADDING = 8;
/** Estimate submenu height so adjustment is stable (no jitter when hovering) */
const SUBMENU_EST_HEIGHT = 320;
const SUBMENU_EST_WIDTH = 140;

export type ObjectContextMenuObjectType =
  | "rect"
  | "circle"
  | "frame"
  | "sticky"
  | "text"
  | "sticker"
  | "line";

export type TextBorderStyle = "none" | "solid";

type ObjectContextMenuProps = {
  objectId: string;
  objectType: ObjectContextMenuObjectType;
  anchor: { x: number; y: number };
  viewport: ViewportState;
  stageWidth: number;
  stageHeight: number;
  currentColor: string;
  strokeStyle?: "solid" | "dashed";
  textBorderStyle?: TextBorderStyle;
  onColorChange: (color: string) => void;
  onCustomColor: () => void;
  onStrokeStyleToggle?: () => void;
  onTextBorderStyleChange?: (style: TextBorderStyle) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ObjectContextMenu({
  objectId,
  objectType,
  anchor,
  viewport,
  stageWidth,
  stageHeight,
  currentColor,
  strokeStyle = "solid",
  textBorderStyle = "none",
  onColorChange,
  onCustomColor,
  onStrokeStyleToggle,
  onTextBorderStyleChange,
  onDuplicate,
  onDelete,
  onClose,
}: ObjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [colorSubmenuOpen, setColorSubmenuOpen] = useState(false);
  const [lineStyleSubmenuOpen, setLineStyleSubmenuOpen] = useState(false);
  const [borderStyleSubmenuOpen, setBorderStyleSubmenuOpen] = useState(false);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });
  const [submenuLeft, setSubmenuLeft] = useState(false);

  const { x: vx, y: vy, scale } = viewport;
  const left = vx + anchor.x * scale;
  const top = vy + anchor.y * scale;

  useLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const menuRect = menuEl.getBoundingClientRect();
    // Use stable estimates including submenu so adjustment doesn't change on hover (avoids jitter)
    const estMaxRight = Math.max(menuRect.right, menuRect.right + SUBMENU_EST_WIDTH - SUBMENU_OVERLAP);
    const estMaxBottom = Math.max(menuRect.bottom, menuRect.top + SUBMENU_EST_HEIGHT);

    let dx = 0;
    let dy = 0;
    if (estMaxRight > window.innerWidth - EDGE_PADDING)
      dx = window.innerWidth - EDGE_PADDING - estMaxRight;
    if (menuRect.left < EDGE_PADDING) dx = EDGE_PADDING - menuRect.left;
    if (estMaxBottom > window.innerHeight - EDGE_PADDING)
      dy = window.innerHeight - EDGE_PADDING - estMaxBottom;
    if (menuRect.top < EDGE_PADDING) dy = EDGE_PADDING - menuRect.top;

    setAdjust({ x: dx, y: dy });

    setSubmenuLeft(menuRect.right + SUBMENU_EST_WIDTH > window.innerWidth - EDGE_PADDING);
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

  const isLine = objectType === "line";
  const hasColor = objectType !== "sticker";

  return (
    <div
      className="pointer-events-auto absolute left-0 top-0 z-40"
      style={{ width: stageWidth, height: stageHeight }}
    >
      <div
        ref={menuRef}
        className="absolute min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        style={{
          left: Math.round(left),
          top: Math.round(top),
          transform: `translate(${adjust.x}px, ${adjust.y}px)`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {hasColor && (
          <div
            className="relative"
            onMouseEnter={() => setColorSubmenuOpen(true)}
            onMouseLeave={() => setColorSubmenuOpen(false)}
          >
            <div
              className={cn(
                "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition",
                colorSubmenuOpen && "bg-slate-100"
              )}
            >
              <span className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-slate-500" />
                Color
              </span>
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-slate-400 transition-transform",
                  submenuLeft && "rotate-180"
                )}
              />
            </div>
            {colorSubmenuOpen && (
              <div
                className="absolute top-0 z-50 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                style={
                  submenuLeft
                    ? { right: "100%", marginRight: -SUBMENU_OVERLAP }
                    : { left: "100%", marginLeft: -SUBMENU_OVERLAP }
                }
                onMouseEnter={() => setColorSubmenuOpen(true)}
                onMouseLeave={() => setColorSubmenuOpen(false)}
              >
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                      color.toLowerCase() === currentColor.toLowerCase() && "bg-slate-100 font-medium"
                    )}
                    onClick={() => {
                      onColorChange(color);
                      setColorSubmenuOpen(false);
                      onClose();
                    }}
                    aria-label={`${COLOR_PRESET_LABELS[color] ?? color}`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span>{COLOR_PRESET_LABELS[color] ?? color}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 transition hover:bg-slate-50"
                  onClick={() => {
                    onCustomColor();
                    setColorSubmenuOpen(false);
                    onClose();
                  }}
                  aria-label="Custom color"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                    <Plus className="h-2.5 w-2.5 text-slate-500" />
                  </span>
                  <span>Custom</span>
                </button>
              </div>
            )}
          </div>
        )}
        {objectType === "text" && onTextBorderStyleChange && (
          <div
            className="relative"
            onMouseEnter={() => setBorderStyleSubmenuOpen(true)}
            onMouseLeave={() => setBorderStyleSubmenuOpen(false)}
          >
            <div
              className={cn(
                "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition",
                borderStyleSubmenuOpen && "bg-slate-100"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded border border-slate-300" aria-hidden />
                Border style
              </span>
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-slate-400 transition-transform",
                  submenuLeft && "rotate-180"
                )}
              />
            </div>
            {borderStyleSubmenuOpen && (
              <div
                className="absolute top-0 z-50 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                style={
                  submenuLeft
                    ? { right: "100%", marginRight: -SUBMENU_OVERLAP }
                    : { left: "100%", marginLeft: -SUBMENU_OVERLAP }
                }
                onMouseEnter={() => setBorderStyleSubmenuOpen(true)}
                onMouseLeave={() => setBorderStyleSubmenuOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                    textBorderStyle === "none" && "bg-slate-100 font-medium"
                  )}
                  onClick={() => {
                    onTextBorderStyleChange("none");
                    setBorderStyleSubmenuOpen(false);
                    onClose();
                  }}
                >
                  None
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                    textBorderStyle === "solid" && "bg-slate-100 font-medium"
                  )}
                  onClick={() => {
                    onTextBorderStyleChange("solid");
                    setBorderStyleSubmenuOpen(false);
                    onClose();
                  }}
                >
                  Solid
                </button>
              </div>
            )}
          </div>
        )}
        {isLine && onStrokeStyleToggle && (
          <div
            className="relative"
            onMouseEnter={() => setLineStyleSubmenuOpen(true)}
            onMouseLeave={() => setLineStyleSubmenuOpen(false)}
          >
            <div
              className={cn(
                "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition",
                lineStyleSubmenuOpen && "bg-slate-100"
              )}
            >
              <span className="flex items-center gap-2">
                <Minus className="h-3.5 w-3.5 text-slate-500" />
                Line style
              </span>
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-slate-400 transition-transform",
                  submenuLeft && "rotate-180"
                )}
              />
            </div>
            {lineStyleSubmenuOpen && (
              <div
                className="absolute top-0 z-50 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                style={
                  submenuLeft
                    ? { right: "100%", marginRight: -SUBMENU_OVERLAP }
                    : { left: "100%", marginLeft: -SUBMENU_OVERLAP }
                }
                onMouseEnter={() => setLineStyleSubmenuOpen(true)}
                onMouseLeave={() => setLineStyleSubmenuOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                    strokeStyle === "solid" && "bg-slate-100 font-medium"
                  )}
                  onClick={() => {
                    strokeStyle !== "solid" && onStrokeStyleToggle();
                    setLineStyleSubmenuOpen(false);
                    onClose();
                  }}
                >
                  Solid
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                    strokeStyle === "dashed" && "bg-slate-100 font-medium"
                  )}
                  onClick={() => {
                    strokeStyle !== "dashed" && onStrokeStyleToggle();
                    setLineStyleSubmenuOpen(false);
                    onClose();
                  }}
                >
                  Dashed
                </button>
              </div>
            )}
          </div>
        )}
        {(hasColor || isLine) && <div className="my-2 border-t border-slate-100" />}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
          onClick={() => {
            onDuplicate();
            onClose();
          }}
        >
          <Copy className="h-3.5 w-3.5 text-slate-500" />
          Duplicate
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-600 transition hover:bg-red-50"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
