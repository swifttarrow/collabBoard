"use client";

import { useEffect, useCallback } from "react";
import type { BoardObject, ViewportState } from "@/lib/board/types";
import { getChildren } from "@/lib/board/scene-graph";
import { zoomInPreset, zoomOutPreset, zoomToFit, resetZoom } from "@/lib/viewport/tools";

const CLIPBOARD_PREFIX = "collabboard:";
/** Fallback offset when viewport is unavailable */
const PASTE_OFFSET_FALLBACK = 20;

function computePasteOffset(
  items: Array<{ x?: number; y?: number; width?: number; height?: number; type?: string; data?: unknown }>,
  viewport: ViewportState | undefined,
  stageWidth: number,
  stageHeight: number
): { offsetX: number; offsetY: number } {
  if (
    !viewport ||
    stageWidth <= 0 ||
    stageHeight <= 0 ||
    items.length === 0
  ) {
    return { offsetX: PASTE_OFFSET_FALLBACK, offsetY: PASTE_OFFSET_FALLBACK };
  }
  const { x: vx, y: vy, scale } = viewport;
  const viewportCenterX = (stageWidth / 2 - vx) / scale;
  const viewportCenterY = (stageHeight / 2 - vy) / scale;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const ix = item.x ?? 0;
    const iy = item.y ?? 0;
    const iw = (item.width ?? 100) as number;
    const ih = (item.height ?? 100) as number;
    if (item.type === "line" && item.data && typeof item.data === "object") {
      const d = item.data as { x2?: number; y2?: number };
      const x2 = d.x2 ?? ix;
      const y2 = d.y2 ?? iy;
      minX = Math.min(minX, ix, x2);
      minY = Math.min(minY, iy, y2);
      maxX = Math.max(maxX, ix, x2);
      maxY = Math.max(maxY, iy, y2);
    } else {
      minX = Math.min(minX, ix);
      minY = Math.min(minY, iy);
      maxX = Math.max(maxX, ix + iw);
      maxY = Math.max(maxY, iy + ih);
    }
  }
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;
  return {
    offsetX: viewportCenterX - bboxCenterX,
    offsetY: viewportCenterY - bboxCenterY,
  };
}

function isEditingInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.getAttribute("contenteditable") === "true";
}

type UseKeyboardShortcutsParams = {
  selection: string[];
  objects: Record<string, BoardObject>;
  addObject: (object: BoardObject) => void;
  removeObject: (id: string) => void;
  clearSelection: () => void;
  setSelection: (ids: string[] | string | null) => void;
  isEditingText: boolean;
  /** Viewport for paste placement (center pasted items in view) */
  viewport?: ViewportState;
  /** When provided, enables zoom shortcuts (Cmd/Ctrl + +/-, 0, 1) */
  stageWidth?: number;
  stageHeight?: number;
  /** Version history: undo, redo, save */
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onDeleteSelection?: (ids: string[]) => void;
  onConfirmDeleteMany?: (count: number) => Promise<boolean>;
  /** Called after paste with pasted root ids (for z-order elevation) */
  onPasted?: (pastedRootIds: string[]) => void;
};

export function useKeyboardShortcuts({
  selection,
  objects,
  addObject,
  removeObject,
  clearSelection,
  setSelection,
  isEditingText,
  viewport,
  stageWidth = 0,
  stageHeight = 0,
  onUndo,
  onRedo,
  onSave,
  onDeleteSelection,
  onConfirmDeleteMany,
  onPasted,
}: UseKeyboardShortcutsParams) {
  const copy = useCallback(() => {
    if (selection.length === 0) return;
    const collected = new Map<string, BoardObject>();
    const addWithDescendants = (obj: BoardObject) => {
      if (collected.has(obj.id)) return;
      collected.set(obj.id, obj);
      if (obj.type === "frame") {
        for (const child of getChildren(obj.id, objects as Record<string, BoardObject & { parentId?: string | null }>)) {
          addWithDescendants(child);
        }
      }
    };
    for (const id of selection) {
      const obj = objects[id];
      if (obj) addWithDescendants(obj);
    }
    const toCopy = Array.from(collected.values());
    if (toCopy.length === 0) return;
    const payload = JSON.stringify(
      toCopy.map((o) => ({
        id: o.id,
        parentId: o.parentId ?? null,
        type: o.type,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        color: o.color,
        text: o.text,
        data: o.data,
        clipContent: o.clipContent,
      }))
    );
    void navigator.clipboard.writeText(CLIPBOARD_PREFIX + payload);
  }, [selection, objects]);

  const paste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.startsWith(CLIPBOARD_PREFIX)) return;
      const payload = text.slice(CLIPBOARD_PREFIX.length);
      const parsed = JSON.parse(payload) as Array<
        Partial<BoardObject> & { type: BoardObject["type"]; id?: string; parentId?: string | null }
      >;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const validTypes: BoardObject["type"][] = ["sticky", "text", "rect", "circle", "line", "frame", "sticker"];
      const filtered = parsed.filter((p) => p && validTypes.includes(p.type as BoardObject["type"]));
      if (filtered.length === 0) return;
      if (selection.length > 0) clearSelection();

      const hasHierarchy = filtered.some((p) => p.id != null && p.parentId != null);
      const idMap = new Map<string, string>();

      if (hasHierarchy) {
        const byId = new Map<string, (typeof filtered)[0]>();
        for (const p of filtered) {
          if (p.id) byId.set(p.id, p);
        }
        const order: (typeof filtered)[0][] = [];
        const visited = new Set<string>();
        const visit = (item: (typeof filtered)[0]) => {
          if (!item?.id || visited.has(item.id)) return;
          const parentId = item.parentId ?? null;
          if (parentId && byId.has(parentId)) {
            visit(byId.get(parentId)!);
          }
          visited.add(item.id);
          order.push(item);
        };
        for (const item of filtered) {
          visit(item);
        }
        const roots = order.filter((o) => (o.parentId ?? null) === null || !byId.has(o.parentId!));
        const { offsetX, offsetY } = computePasteOffset(
          roots,
          viewport,
          stageWidth,
          stageHeight
        );
        const pastedRootIds: string[] = [];
        for (const item of order) {
          if (!item.type) continue;
          const newId = crypto.randomUUID();
          if (item.id) idMap.set(item.id, newId);
          const oldParentId = item.parentId ?? null;
          const newParentId = oldParentId && idMap.has(oldParentId) ? idMap.get(oldParentId)! : null;
          const isRoot = newParentId === null;
          const dx = isRoot ? offsetX : 0;
          const dy = isRoot ? offsetY : 0;
          const x = (item.x ?? 0) + dx;
          const y = (item.y ?? 0) + dy;
          let data = item.data;
          if (
            item.type === "line" &&
            data &&
            typeof data.x2 === "number" &&
            typeof data.y2 === "number" &&
            isRoot
          ) {
            data = { ...data, x2: data.x2 + dx, y2: data.y2 + dy };
          }
          const obj: BoardObject = {
            id: newId,
            type: item.type,
            parentId: newParentId,
            clipContent: item.clipContent,
            x,
            y,
            width: item.width ?? 100,
            height: item.height ?? 100,
            rotation: item.rotation ?? 0,
            color: item.color ?? "#94a3b8",
            text: item.text ?? "",
            data,
          };
          addObject(obj);
          if (isRoot) pastedRootIds.push(newId);
        }
        setSelection(Array.from(idMap.values()));
        onPasted?.(pastedRootIds);
      } else {
        const { offsetX, offsetY } = computePasteOffset(
          filtered,
          viewport,
          stageWidth,
          stageHeight
        );
        const newIds: string[] = [];
        for (const item of filtered) {
          if (!item.type) continue;
          const id = crypto.randomUUID();
          newIds.push(id);
          const x = (item.x ?? 0) + offsetX;
          const y = (item.y ?? 0) + offsetY;
          let data = item.data;
          if (item.type === "line" && data && typeof data.x2 === "number" && typeof data.y2 === "number") {
            data = { ...data, x2: data.x2 + offsetX, y2: data.y2 + offsetY };
          }
          const obj: BoardObject = {
            id,
            type: item.type,
            parentId: null,
            clipContent: item.clipContent,
            x,
            y,
            width: item.width ?? 100,
            height: item.height ?? 100,
            rotation: item.rotation ?? 0,
            color: item.color ?? "#94a3b8",
            text: item.text ?? "",
            data,
          };
          addObject(obj);
        }
        setSelection(newIds);
        onPasted?.(newIds);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[useKeyboardShortcuts] Paste failed (clipboard/format):", err);
      }
    }
  }, [addObject, clearSelection, setSelection, selection, onPasted, viewport, stageWidth, stageHeight]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditingInput() || isEditingText) return;

      const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "c") {
        e.preventDefault();
        copy();
        return;
      }
      if (mod && e.key === "v") {
        e.preventDefault();
        void paste();
        return;
      }
      if (mod && e.key === "z" && !e.shiftKey && onUndo) {
        e.preventDefault();
        onUndo();
        return;
      }
      if ((mod && e.shiftKey && e.key === "z") || (mod && e.key === "y")) {
        e.preventDefault();
        onRedo?.();
        return;
      }
      if (mod && e.key === "s" && onSave) {
        e.preventDefault();
        onSave();
        return;
      }

      // Zoom shortcuts (Cmd/Ctrl + +, -, 0, 1)
      if (stageWidth > 0 && stageHeight > 0) {
        if (mod && (e.key === "=" || e.key === "+")) {
          e.preventDefault();
          zoomInPreset(stageWidth, stageHeight);
          return;
        }
        if (mod && e.key === "-") {
          e.preventDefault();
          zoomOutPreset(stageWidth, stageHeight);
          return;
        }
        if (mod && e.key === "0") {
          e.preventDefault();
          resetZoom(stageWidth, stageHeight);
          return;
        }
        if (mod && e.key === "1") {
          e.preventDefault();
          zoomToFit(stageWidth, stageHeight);
          return;
        }
      }

      if (e.key === "Escape") {
        if (selection.length > 0) {
          e.preventDefault();
          clearSelection();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.length === 0) return;
        e.preventDefault();
        const idsToDelete = [...selection];
        void (async () => {
          if (idsToDelete.length > 1 && onConfirmDeleteMany) {
            const confirmed = await onConfirmDeleteMany(idsToDelete.length);
            if (!confirmed) return;
          }
          if (onDeleteSelection) {
            onDeleteSelection(idsToDelete);
            return;
          }
          for (const id of idsToDelete) {
            removeObject(id);
          }
          clearSelection();
        })();
      }
    },
    [
      copy,
      paste,
      selection,
      clearSelection,
      removeObject,
      isEditingText,
      onUndo,
      onRedo,
      onSave,
      stageWidth,
      stageHeight,
      onDeleteSelection,
      onConfirmDeleteMany,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { copy, paste };
}
