"use client";

import { useEffect, useCallback } from "react";
import type { BoardObject } from "@/lib/board/types";

const CLIPBOARD_PREFIX = "collabboard:";
const PASTE_OFFSET = 20;

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
  isEditingSticky: boolean;
};

export function useKeyboardShortcuts({
  selection,
  objects,
  addObject,
  removeObject,
  clearSelection,
  setSelection,
  isEditingSticky,
}: UseKeyboardShortcutsParams) {
  const copy = useCallback(() => {
    if (selection.length === 0) return;
    const toCopy = selection
      .map((id) => objects[id])
      .filter((o): o is BoardObject => o != null);
    if (toCopy.length === 0) return;
    const payload = JSON.stringify(
      toCopy.map((o) => ({
        type: o.type,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        color: o.color,
        text: o.text,
        data: o.data,
      }))
    );
    void navigator.clipboard.writeText(CLIPBOARD_PREFIX + payload);
  }, [selection, objects]);

  const paste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.startsWith(CLIPBOARD_PREFIX)) return;
      const payload = text.slice(CLIPBOARD_PREFIX.length);
      const parsed = JSON.parse(payload) as Array<Partial<BoardObject> & { type: BoardObject["type"] }>;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const validTypes: BoardObject["type"][] = ["sticky", "rect", "circle", "line"];
      const filtered = parsed.filter((p) => p && validTypes.includes(p.type as BoardObject["type"]));
      if (filtered.length === 0) return;
      if (selection.length > 0) clearSelection();
      const newIds: string[] = [];
      for (const item of filtered) {
        if (!item.type) continue;
        const id = crypto.randomUUID();
        const x = (item.x ?? 0) + PASTE_OFFSET;
        const y = (item.y ?? 0) + PASTE_OFFSET;
        let data = item.data;
        if (item.type === "line" && data && typeof data.x2 === "number" && typeof data.y2 === "number") {
          data = { x2: data.x2 + PASTE_OFFSET, y2: data.y2 + PASTE_OFFSET };
        }
        const obj: BoardObject = {
          id,
          type: item.type,
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
        newIds.push(id);
      }
      setSelection(newIds);
    } catch {
      // No collabboard data or clipboard read failed
    }
  }, [addObject, clearSelection, setSelection, selection]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditingInput() || isEditingSticky) return;

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
        if (selection.length > 1) {
          const ok = window.confirm(`Delete ${selection.length} selected items?`);
          if (!ok) return;
        }
        for (const id of selection) {
          removeObject(id);
        }
        clearSelection();
      }
    },
    [copy, paste, selection, clearSelection, removeObject, isEditingSticky]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
