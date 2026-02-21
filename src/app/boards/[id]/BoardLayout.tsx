"use client";

import Link from "next/link";
import { CanvasBoardClient } from "@/components/CanvasBoardClient";
import { BoardHeader } from "./BoardHeader";
import { BoardPresenceProvider } from "@/components/canvas/BoardPresenceProvider";
import { CanvasToolbarProvider, useCanvasToolbar } from "@/components/canvas/CanvasToolbarContext";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { AIChatFloating } from "@/components/board/AIChatFloating";
import { MountedOnly } from "@/components/MountedOnly";
import { PerformanceMetricsInline } from "@/components/debug/PerformanceMetricsInline";
import { VersionHistoryProvider } from "@/components/version-history/VersionHistoryProvider";
import { VersionHistoryPanelContainer } from "@/components/version-history/VersionHistoryPanelContainer";
import { BoardMenuBar } from "@/components/board/BoardMenuBar";
import type { BoardMember } from "@/components/CanvasBoardClient";

function CanvasToolbarSlot() {
  const {
    activeTool,
    setActiveTool,
    lineStyle,
    setLineStyle,
    perfEnabled,
    setPerfEnabled,
    pendingStickerSlug,
    setPendingStickerSlug,
  } = useCanvasToolbar();
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 [&>*]:pointer-events-auto">
      {perfEnabled && <PerformanceMetricsInline />}
      <CanvasToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        lineStyle={lineStyle}
        onLineStyleChange={setLineStyle}
        perfEnabled={perfEnabled}
        onPerfToggle={() => setPerfEnabled(!perfEnabled)}
        onSelectSticker={(slug) => setPendingStickerSlug(slug)}
        pendingStickerSlug={pendingStickerSlug}
      />
    </div>
  );
}

type Props = {
  boardId: string;
  boardTitle: string;
  members: BoardMember[];
  isOwner: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarColor?: string | null;
  } | null;
};

function BoardLayoutSkeleton({ boardTitle }: { boardTitle: string }) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-slate-50/50 px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Link
          href="/boards"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Boards
        </Link>
        <span className="flex-1 truncate text-base font-medium text-slate-700">{boardTitle}</span>
      </header>
      <div id="canvas-container" className="relative min-h-0 flex-1 overflow-hidden bg-slate-100" />
    </div>
  );
}

export function BoardLayout({
  boardId,
  boardTitle,
  members,
  isOwner,
  user,
}: Props) {
  return (
    <BoardPresenceProvider boardId={boardId}>
      <CanvasToolbarProvider>
        <VersionHistoryProvider boardId={boardId}>
          <MountedOnly fallback={<BoardLayoutSkeleton boardTitle={boardTitle} />}>
            <div className="flex h-screen flex-col">
              {user ? (
                <>
                  <BoardHeader
                    boardTitle={boardTitle}
                    members={members}
                    user={user}
                  />
                  <BoardMenuBar boardId={boardId} boardTitle={boardTitle} isOwner={isOwner} />
                </>
              ) : (
                <>
                  <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-slate-50/50 px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <Link
                      href="/boards"
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      ← Boards
                    </Link>
                    <span className="flex-1 truncate text-base font-medium text-slate-700">{boardTitle}</span>
                  </header>
                  <BoardMenuBar boardId={boardId} boardTitle={boardTitle} isOwner={isOwner} />
                </>
              )}
              <div className="flex min-h-0 flex-1 flex-row">
                <div
                  id="canvas-container"
                  className="relative min-w-0 flex-1 overflow-hidden"
                  style={{
                    backgroundImage: `radial-gradient(circle at center, rgba(100, 116, 139, 0.2) 1.5px, transparent 1.5px),
                      linear-gradient(to bottom right, rgb(241 245 249), rgb(248 250 252), rgba(238, 242, 255, 0.3))`,
                    backgroundSize: "24px 24px, 100% 100%",
                  }}
                >
                  <CanvasToolbarSlot />
                  <CanvasBoardClient boardId={boardId} />
                  {user && <AIChatFloating boardId={boardId} />}
                </div>
                <VersionHistoryPanelContainer />
              </div>
            </div>
          </MountedOnly>
        </VersionHistoryProvider>
      </CanvasToolbarProvider>
    </BoardPresenceProvider>
  );
}
