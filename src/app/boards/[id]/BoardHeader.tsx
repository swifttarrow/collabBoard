"use client";

import Link from "next/link";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  boardId: string;
  boardTitle: string;
  members: BoardMember[];
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarColor?: string | null;
  };
  isOwner: boolean;
};

export function BoardHeader({ boardId, boardTitle, members, user, isOwner }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(boardTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(boardTitle);
  }, [boardTitle]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(
    async (value: string) => {
      const trimmed = value.trim() || "Untitled board";
      if (trimmed === boardTitle) {
        setIsEditing(false);
        return;
      }
      const { updateBoardTitle } = await import("@/app/boards/actions");
      const result = await updateBoardTitle(boardId, trimmed);
      if (result?.error) {
        const { toast } = await import("sonner");
        toast.error(result.error);
      }
      setIsEditing(false);
      if (result?.success) router.refresh();
    },
    [boardId, boardTitle, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave(editValue);
      }
      if (e.key === "Escape") {
        setEditValue(boardTitle);
        setIsEditing(false);
        inputRef.current?.blur();
      }
    },
    [editValue, boardTitle, handleSave]
  );

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
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-background/95 px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <Link
        href="/boards"
        className="min-w-0 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Boards
      </Link>
      <div className="flex min-w-0 flex-1 justify-center px-2">
        {isEditing && isOwner ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(editValue)}
            onKeyDown={handleKeyDown}
            className="w-full min-w-0 max-w-md truncate rounded border border-input bg-background px-2 py-0.5 text-center text-lg font-semibold tracking-tight text-foreground outline-none ring-2 ring-ring ring-offset-2 ring-offset-background"
            aria-label="Board name"
          />
        ) : (
          <button
            type="button"
            onClick={() => isOwner && setIsEditing(true)}
            className={`truncate text-lg font-semibold tracking-tight text-foreground ${isOwner ? "cursor-pointer rounded px-2 py-1 hover:bg-accent/50" : "cursor-default px-2"}`}
            aria-label={isOwner ? "Edit board name" : "Board name"}
          >
            {boardTitle}
          </button>
        )}
      </div>
      <div className="flex min-w-0 shrink items-center justify-end gap-3">
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
          <div className="h-8 w-px shrink-0 bg-border" aria-hidden="true" />
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
            className={`h-8 w-8 shrink-0 ${vh.openHistoryPanel ? "bg-accent text-accent-foreground hover:bg-accent/80" : ""}`}
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
