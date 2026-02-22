"use client";

import { CanvasBoardClient } from "@/components/CanvasBoardClient";
import { AIChatFloating } from "@/components/board/AIChatFloating";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import {
  CanvasToolbarProvider,
  useCanvasToolbar,
} from "@/components/canvas/CanvasToolbarContext";
import { BoardPresenceProvider } from "@/components/canvas/BoardPresenceProvider";
import { VersionHistoryProvider } from "@/components/version-history/VersionHistoryProvider";
import { useBoardStore } from "@/lib/board/store";

const E2E_BOARD_ID = "e2e-board";

function E2EDiagnostics() {
  const objectCount = useBoardStore((state) => Object.keys(state.objects).length);
  const selectionCount = useBoardStore((state) => state.selection.length);

  return (
    <div className="absolute left-4 top-4 z-[120] rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm">
      <div data-testid="e2e-object-count">objects: {objectCount}</div>
      <div data-testid="e2e-selection-count">selection: {selectionCount}</div>
    </div>
  );
}

function CanvasToolbarSlot() {
  const {
    activeTool,
    setActiveTool,
    lastShapeTool,
    perfEnabled,
    setPerfEnabled,
    pendingStickerSlug,
    setPendingStickerSlug,
  } = useCanvasToolbar();

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 [&>*]:pointer-events-auto">
      <CanvasToolbar
        activeTool={activeTool}
        lastShapeTool={lastShapeTool}
        onSelectTool={setActiveTool}
        perfEnabled={perfEnabled}
        onPerfToggle={() => setPerfEnabled(!perfEnabled)}
        onSelectSticker={(slug) => setPendingStickerSlug(slug)}
        pendingStickerSlug={pendingStickerSlug}
      />
    </div>
  );
}

export default function E2EBoardPage() {
  return (
    <BoardPresenceProvider boardId={E2E_BOARD_ID}>
      <CanvasToolbarProvider>
        <VersionHistoryProvider boardId={E2E_BOARD_ID}>
          <div className="relative h-screen w-screen overflow-hidden bg-slate-100">
            <div
              id="canvas-container"
              className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
            >
              <E2EDiagnostics />
              <CanvasToolbarSlot />
              <CanvasBoardClient boardId={E2E_BOARD_ID} />
              <AIChatFloating boardId={E2E_BOARD_ID} />
            </div>
          </div>
        </VersionHistoryProvider>
      </CanvasToolbarProvider>
    </BoardPresenceProvider>
  );
}
