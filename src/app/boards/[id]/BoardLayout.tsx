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
    <div className="pointer-events-none absolute left-6 right-6 top-6 z-[100] flex items-start justify-between gap-4 [&>*]:pointer-events-auto">
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
      {perfEnabled && <PerformanceMetricsInline />}
    </div>
  );
}

type Props = {
  boardId: string;
  boardTitle: string;
  members: BoardMember[];
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
  user,
}: Props) {
  return (
    <BoardPresenceProvider boardId={boardId}>
      <CanvasToolbarProvider>
        <MountedOnly fallback={<BoardLayoutSkeleton boardTitle={boardTitle} />}>
          <div className="flex h-screen flex-col">
            {user ? (
              <>
                <BoardHeader
                  boardTitle={boardTitle}
                  members={members}
                  user={user}
                />
                <AIChatFloating boardId={boardId} />
              </>
            ) : (
              <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-slate-50/50 px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <Link
                  href="/boards"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  ← Boards
                </Link>
                <span className="flex-1 truncate text-base font-medium text-slate-700">{boardTitle}</span>
              </header>
            )}
            <div
              id="canvas-container"
              className="relative min-h-0 flex-1 overflow-hidden"
              style={{
                backgroundImage: `radial-gradient(circle at center, rgba(100, 116, 139, 0.2) 1.5px, transparent 1.5px),
                  linear-gradient(to bottom right, rgb(241 245 249), rgb(248 250 252), rgba(238, 242, 255, 0.3))`,
                backgroundSize: "24px 24px, 100% 100%",
              }}
            >
              <CanvasToolbarSlot />
              <CanvasBoardClient boardId={boardId} />
            </div>
          </div>
        </MountedOnly>
      </CanvasToolbarProvider>
    </BoardPresenceProvider>
  );
}
