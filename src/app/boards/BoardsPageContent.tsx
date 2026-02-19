"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";

export type BoardWithMembership = {
  id: string;
  title: string;
  created_at: string;
  isMember: boolean;
};

function BoardCard({
  board,
  showMemberIndicator,
}: {
  board: BoardWithMembership;
  showMemberIndicator: boolean;
}) {
  return (
    <li>
      <Link
        href={`/boards/${board.id}`}
        prefetch={false}
        className="group relative block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
      >
        {showMemberIndicator && (
          <span className="group/icon absolute -right-1 -top-1">
            <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/icon:opacity-100">
              Member
            </span>
            <Bookmark className="h-5 w-5 fill-red-200 stroke-red-500" />
          </span>
        )}
        <span className="block pr-8 font-medium text-slate-900">{board.title}</span>
        <p className="mt-1 text-xs text-slate-500">
          {new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(board.created_at))}
        </p>
      </Link>
    </li>
  );
}

type Props = {
  allBoards: BoardWithMembership[];
  error?: string | null;
};

export function BoardsPageContent({ allBoards, error }: Props) {
  const [tab, setTab] = useState<"mine" | "all">("mine");

  const myBoards = allBoards.filter((b) => b.isMember);

  return (
    <>
      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "mine"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          My boards
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "all"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          All boards
        </button>
      </div>

      {error && (
        <div className="mb-6 mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Couldn&apos;t load boards</p>
          <p className="mt-1 text-amber-800">{error}</p>
          <Link href="/boards" className="mt-2 inline-block text-sm font-medium underline">
            Try again
          </Link>
        </div>
      )}

      {tab === "mine" && (
        <>
          {myBoards.length === 0 && !error && (
            <p className="mt-8 text-center text-slate-500">
              No boards yet. Create one above or browse all boards.
            </p>
          )}
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myBoards.map((board) => (
              <BoardCard key={board.id} board={board} showMemberIndicator />
            ))}
          </ul>
        </>
      )}

      {tab === "all" && (
        <>
          {allBoards.length === 0 && !error && (
            <p className="mt-8 text-center text-slate-500">No boards yet. Create one above.</p>
          )}
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                showMemberIndicator={board.isMember}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
