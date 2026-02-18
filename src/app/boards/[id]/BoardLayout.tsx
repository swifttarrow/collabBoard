"use client";

import Link from "next/link";
import { CanvasBoardClient } from "@/components/CanvasBoardClient";
import { BoardHeader } from "./BoardHeader";
import { BoardPresenceProvider } from "@/components/canvas/BoardPresenceProvider";
import type { BoardMember } from "@/components/CanvasBoardClient";

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

export function BoardLayout({
  boardId,
  boardTitle,
  members,
  user,
}: Props) {
  return (
    <BoardPresenceProvider boardId={boardId}>
      <div className="flex h-screen flex-col">
        {user ? (
          <BoardHeader
            boardTitle={boardTitle}
            members={members}
            user={user}
          />
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
        <div className="min-h-0 flex-1">
          <CanvasBoardClient boardId={boardId} />
        </div>
      </div>
    </BoardPresenceProvider>
  );
}
