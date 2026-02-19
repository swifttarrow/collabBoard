"use client";

import Link from "next/link";
import { CanvasBoardClient } from "@/components/CanvasBoardClient";
import { BoardHeader } from "./BoardHeader";
import { BoardPresenceProvider } from "@/components/canvas/BoardPresenceProvider";
import { CanvasToolbarProvider, useCanvasToolbar } from "@/components/canvas/CanvasToolbarContext";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { AIChatFloating } from "@/components/board/AIChatFloating";
import { MountedOnly } from "@/components/MountedOnly";
import type { BoardMember } from "@/components/CanvasBoardClient";

function CanvasToolbarSlot() {
  const { activeTool, setActiveTool, lineStyle, setLineStyle } = useCanvasToolbar();
  return (
    <div className="pointer-events-none absolute left-6 top-6 z-[100] [&>*]:pointer-events-auto">
      <CanvasToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        lineStyle={lineStyle}
        onLineStyleChange={setLineStyle}
      />
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
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <Link
          href="/boards"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Boards
        </Link>
        <span className="flex-1 text-sm text-slate-500">{boardTitle}</span>
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
              <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
                <Link
                  href="/boards"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  ← Boards
                </Link>
                <span className="flex-1 text-sm text-slate-500">{boardTitle}</span>
              </header>
            )}
            <div id="canvas-container" className="relative min-h-0 flex-1 overflow-hidden">
              <CanvasToolbarSlot />
              <CanvasBoardClient boardId={boardId} />
            </div>
          </div>
        </MountedOnly>
      </CanvasToolbarProvider>
    </BoardPresenceProvider>
  );
}
