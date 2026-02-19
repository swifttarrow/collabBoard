"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { BoardMembersToolbar } from "@/components/canvas/BoardMembersToolbar";
import { UserMenu } from "@/components/UserMenu";
import type { BoardMember } from "@/components/CanvasBoardClient";

type Props = {
  boardTitle: string;
  members: BoardMember[];
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarColor?: string | null;
  };
};

export function BoardHeader({ boardTitle, members, user }: Props) {
  const {
    activeUserIds,
    presenceNames,
    presenceMembers,
    followingUserId,
    followUser,
    unfollowUser,
  } = useBoardPresenceContext();
  const otherMembers = useMemo(() => {
    const byId = new Map<string, BoardMember>();
    for (const m of members) {
      if (m.id !== user.id) byId.set(m.id, m);
    }
    for (const m of presenceMembers) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
    return Array.from(byId.values());
  }, [members, user.id, presenceMembers]);

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
      <Link
        href="/boards"
        className="text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Boards
      </Link>
      <span className="flex-1 truncate text-sm text-slate-500">{boardTitle}</span>
      <div className="flex min-w-0 shrink items-center gap-3">
        <BoardMembersToolbar
          members={otherMembers}
          activeUserIds={activeUserIds}
          variant="header"
          presenceNames={presenceNames}
          followingUserId={followingUserId}
          onFollowClick={(memberId) => {
            if (followingUserId === memberId) unfollowUser();
            else if (activeUserIds.has(memberId)) followUser(memberId);
          }}
        />
        {otherMembers.length > 0 && (
          <div
            className="h-8 w-px shrink-0 bg-slate-200"
            aria-hidden="true"
          />
        )}
        <UserMenu
          email={user.email}
          firstName={user.firstName}
          lastName={user.lastName}
          avatarColor={user.avatarColor}
        />
      </div>
    </header>
  );
}
