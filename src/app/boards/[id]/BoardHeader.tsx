"use client";

import Link from "next/link";
import { useMemo } from "react";
import { History } from "lucide-react";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { BoardMembersToolbar } from "@/components/canvas/BoardMembersToolbar";
import { ConnectionBadge } from "@/components/canvas/ConnectionBadge";
import { useVersionHistoryOptional } from "@/components/version-history/VersionHistoryProvider";
import { getAvatarColorFallback } from "@/lib/avatar-colors";
import { Button } from "@/components/ui/button";
import type { BoardMember } from "@/components/CanvasBoardClient";

function getInitials(
  email: string,
  firstName: string | null,
  lastName: string | null
): string {
  if (firstName || lastName) {
    const f = (firstName ?? "").trim().charAt(0).toUpperCase();
    const l = (lastName ?? "").trim().charAt(0).toUpperCase();
    if (f && l) return `${f}${l}`;
    if (f) return f;
    if (l) return l;
  }
  return (email?.charAt(0) ?? "U").toUpperCase();
}

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
  const vh = useVersionHistoryOptional();
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

  const initials = getInitials(user.email, user.firstName ?? null, user.lastName ?? null);
  const color = user.avatarColor ?? getAvatarColorFallback(user.id);

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-slate-50/50 px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <Link
        href="/boards"
        className="text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Boards
      </Link>
      <span className="flex-1 truncate text-base font-medium text-slate-700">{boardTitle}</span>
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
          <div className="h-8 w-px shrink-0 bg-slate-200" aria-hidden="true" />
        )}
        <div
          className="flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ width: 28, height: 28, backgroundColor: color }}
          title="You"
          aria-label="You"
        >
          {initials}
        </div>
        <ConnectionBadge />
        {vh && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 shrink-0 ${vh.openHistoryPanel ? "bg-slate-200 text-slate-900 hover:bg-slate-300" : ""}`}
            onClick={() => vh.setOpenHistoryPanel(!vh.openHistoryPanel)}
            aria-label={vh.openHistoryPanel ? "Close version history" : "Open version history"}
            aria-pressed={vh.openHistoryPanel}
            title="Version history"
          >
            <History className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
