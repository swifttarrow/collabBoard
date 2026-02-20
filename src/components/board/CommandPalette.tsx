"use client";

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  MousePointer2,
  StickyNote,
  Type,
  Square,
  Circle,
  Minus,
  PanelTop,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  X,
  MessageSquare,
  UserMinus,
  Gauge,
  Undo2,
  Redo2,
  History,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogTitle } from "@/components/ui/dialog";
import { useCanvasToolbar } from "@/components/canvas/CanvasToolbarContext";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { useVersionHistoryOptional } from "@/components/version-history/VersionHistoryProvider";
import { toast } from "sonner";
import { zoomInPreset, zoomOutPreset, zoomToFit, resetZoom } from "@/lib/viewport/tools";
import type { Tool } from "@/components/canvas/CanvasToolbar";

export const OPEN_AI_CHAT_EVENT = "collabboard:open-ai-chat";

type CommandPaletteProps = {
  stageWidth: number;
  stageHeight: number;
  selection: string[];
  onCopy: () => void;
  onPaste: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: (ids: string[]) => void;
  onConfirmDeleteMany: (count: number) => Promise<boolean>;
  onClearSelection: () => void;
};

export function CommandPalette({
  stageWidth,
  stageHeight,
  selection,
  onCopy,
  onPaste,
  onDuplicateSelection,
  onDeleteSelection,
  onConfirmDeleteMany,
  onClearSelection,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { setActiveTool, setPerfEnabled, perfEnabled } = useCanvasToolbar();
  const { followingUserId, unfollowUser } = useBoardPresenceContext();
  const vh = useVersionHistoryOptional();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down, true);
    return () => document.removeEventListener("keydown", down, true);
  }, []);

  const run = useCallback(
    (fn: () => void) => {
      fn();
      setOpen(false);
    },
    []
  );

  const selectTool = useCallback(
    (tool: Tool) => run(() => setActiveTool(tool)),
    [run, setActiveTool]
  );

  const zoom = useCallback(() => {
    if (stageWidth <= 0 || stageHeight <= 0) return;
    run(() => zoomInPreset(stageWidth, stageHeight));
  }, [run, stageWidth, stageHeight]);

  const zoomOut = useCallback(() => {
    if (stageWidth <= 0 || stageHeight <= 0) return;
    run(() => zoomOutPreset(stageWidth, stageHeight));
  }, [run, stageWidth, stageHeight]);

  const fit = useCallback(() => {
    if (stageWidth <= 0 || stageHeight <= 0) return;
    run(() => zoomToFit(stageWidth, stageHeight));
  }, [run, stageWidth, stageHeight]);

  const reset = useCallback(() => {
    if (stageWidth <= 0 || stageHeight <= 0) return;
    run(() => resetZoom(stageWidth, stageHeight));
  }, [run, stageWidth, stageHeight]);

  const openAI = useCallback(
    () =>
      run(() => {
        window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT));
      }),
    [run]
  );

  const handleDuplicate = useCallback(() => {
    onDuplicateSelection();
    setOpen(false);
  }, [onDuplicateSelection]);

  const handleDelete = useCallback(async () => {
    const idsToDelete = [...selection];
    if (idsToDelete.length === 0) return;
    if (idsToDelete.length > 1) {
      const confirmed = await onConfirmDeleteMany(idsToDelete.length);
      if (!confirmed) return;
    }
    onDeleteSelection(idsToDelete);
    setOpen(false);
  }, [selection, onConfirmDeleteMany, onDeleteSelection]);

  const hasSelection = selection.length > 0;
  const canZoom = stageWidth > 0 && stageHeight > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      contentClassName="fixed left-[50%] top-[50%] z-[100] grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-0"
    >
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <Command.Input placeholder="Type a command or search… (⌘K)" />
      <Command.List
        className={cn(
          "max-h-[min(400px,70vh)] overflow-y-auto rounded-b-lg border-t border-slate-200 p-2",
          "scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        )}
      >
        <Command.Empty className="py-6 text-center text-sm text-slate-500">
          No results found.
        </Command.Empty>

        <Command.Group heading="Tools">
          <Command.Item value="select tool" onSelect={() => selectTool("select")}>
            <MousePointer2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Select
          </Command.Item>
          <Command.Item value="sticky note" onSelect={() => selectTool("sticky")}>
            <StickyNote className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Sticky note
          </Command.Item>
          <Command.Item value="text" onSelect={() => selectTool("text")}>
            <Type className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Text
          </Command.Item>
          <Command.Item value="frame" onSelect={() => selectTool("frame")}>
            <PanelTop className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Frame
          </Command.Item>
          <Command.Item value="rectangle" onSelect={() => selectTool("rect")}>
            <Square className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Rectangle
          </Command.Item>
          <Command.Item value="circle" onSelect={() => selectTool("circle")}>
            <Circle className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Circle
          </Command.Item>
          <Command.Item value="line" onSelect={() => selectTool("line")}>
            <Minus className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Line
          </Command.Item>
        </Command.Group>

        {canZoom && (
          <Command.Group heading="View">
            <Command.Item value="zoom in" onSelect={zoom}>
              <ZoomIn className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Zoom in
            </Command.Item>
            <Command.Item value="zoom out" onSelect={zoomOut}>
              <ZoomOut className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Zoom out
            </Command.Item>
            <Command.Item value="zoom to fit" onSelect={fit}>
              <Maximize2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Zoom to fit
            </Command.Item>
            <Command.Item value="reset zoom 100%" onSelect={reset}>
              <RotateCcw className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Reset zoom (100%)
            </Command.Item>
          </Command.Group>
        )}

        {vh && (
          <Command.Group heading="Version">
            <Command.Item
              value="undo"
              onSelect={() => run(vh.undo)}
              disabled={!vh.canUndo}
            >
              <Undo2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Undo
            </Command.Item>
            <Command.Item
              value="redo"
              onSelect={() => run(vh.redo)}
              disabled={!vh.canRedo}
            >
              <Redo2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Redo
            </Command.Item>
            <Command.Item
              value="save"
              onSelect={() =>
                run(() => {
                  if (vh.save()) {
                    vh.recordSaveCheckpoint();
                    toast.success("Board saved");
                  }
                })
              }
            >
              <Save className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Save
            </Command.Item>
            <Command.Item
              value="open version history"
              onSelect={() => run(() => vh.setOpenHistoryPanel(!vh.openHistoryPanel))}
            >
              <History className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              {vh.openHistoryPanel ? "Close version history" : "Open version history"}
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading="Edit">
          <Command.Item
            value="copy"
            onSelect={() => run(onCopy)}
            disabled={!hasSelection}
          >
            <Copy className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Copy
          </Command.Item>
          <Command.Item value="paste" onSelect={() => run(() => void onPaste())}>
            <ClipboardPaste className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Paste
          </Command.Item>
          <Command.Item
            value="duplicate"
            onSelect={handleDuplicate}
            disabled={!hasSelection}
          >
            <CopyPlus className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Duplicate
          </Command.Item>
          <Command.Item
            value="delete"
            onSelect={() => void handleDelete()}
            disabled={!hasSelection}
          >
            <Trash2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Delete
          </Command.Item>
          <Command.Item
            value="clear selection"
            onSelect={() => run(onClearSelection)}
            disabled={!hasSelection}
          >
            <X className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Clear selection
          </Command.Item>
        </Command.Group>

        <Command.Group heading="AI">
          <Command.Item value="open scribbs chat" onSelect={openAI}>
            <MessageSquare className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Open Scribbs
          </Command.Item>
        </Command.Group>

        {followingUserId && (
          <Command.Group heading="Collaboration">
            <Command.Item value="unfollow" onSelect={() => run(unfollowUser)}>
              <UserMinus className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
              Unfollow
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading="Debug">
          <Command.Item
            value="toggle performance metrics"
            onSelect={() => run(() => setPerfEnabled(!perfEnabled))}
          >
            <Gauge className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            Toggle performance metrics
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
