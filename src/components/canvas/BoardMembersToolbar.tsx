"use client";

import { cn } from "@/lib/utils";
import {
  getAvatarColorFallback,
  getInitialsFromName,
} from "@/lib/avatar-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_VISIBLE_AVATARS = 6;
const AVATAR_SIZE_TOOLBAR = 32;
const AVATAR_SIZE_HEADER = 28;
const AVATAR_GAP = 4;

export type BoardMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_color?: string | null;
};

type PresenceNames = Record<string, string>;

type Props = {
  members: BoardMember[];
  activeUserIds: Set<string>;
  variant?: "toolbar" | "header";
  /** Real-time names from presence (userId -> display name) - used when profile data is missing */
  presenceNames?: PresenceNames;
  /** ID of user currently being followed; clicking their avatar unfollows */
  followingUserId?: string | null;
  /** Called when an active avatar is clicked; pass member.id to follow, or same as followingUserId to unfollow */
  onFollowClick?: (memberId: string) => void;
};

function getInitials(
  firstName: string | null,
  lastName: string | null,
  presenceName?: string | null
): string {
  if (firstName || lastName) {
    const f = (firstName ?? "").trim().charAt(0).toUpperCase();
    const l = (lastName ?? "").trim().charAt(0).toUpperCase();
    if (f && l) return `${f}${l}`;
    if (f) return f;
    if (l) return l;
  }
  const fromPresence = getInitialsFromName(presenceName);
  if (fromPresence) return fromPresence;
  return "U";
}

function MemberAvatar({
  member,
  isActive,
  isFollowed,
  size = AVATAR_SIZE_TOOLBAR,
  variant: _variant = "toolbar",
  presenceName,
  onClick,
}: {
  member: BoardMember;
  isActive: boolean;
  isFollowed?: boolean;
  size?: number;
  variant?: "toolbar" | "header";
  presenceName?: string | null;
  onClick?: () => void;
}) {
  const initials = getInitials(
    member.first_name,
    member.last_name,
    presenceName
  );
  const color = member.avatar_color ?? getAvatarColorFallback(member.id);
  const displayName =
    member.first_name || member.last_name
      ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
      : presenceName ?? "Unknown";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isActive || !onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        isActive && onClick && "cursor-pointer hover:opacity-90",
        !isActive && "cursor-default",
        isFollowed &&
          "shadow-[0_0_14px_4px_rgba(96,165,250,0.55)]"
      )}
      style={{ width: size, height: size, backgroundColor: color }}
      title={
        isFollowed
          ? `Following ${displayName} (click to unfollow)`
          : isActive && onClick
            ? `Follow ${displayName}`
            : displayName
      }
      aria-label={
        isFollowed
          ? `Unfollow ${displayName}`
          : isActive && onClick
            ? `Follow ${displayName}`
            : undefined
      }
    >
      {initials}
    </button>
  );
}

export function BoardMembersToolbar({
  members,
  activeUserIds,
  variant = "toolbar",
  presenceNames = {},
  followingUserId = null,
  onFollowClick,
}: Props) {
  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = members.slice(MAX_VISIBLE_AVATARS);
  const avatarSize = variant === "header" ? AVATAR_SIZE_HEADER : AVATAR_SIZE_TOOLBAR;

  const isToolbar = variant === "toolbar";

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        isToolbar &&
          "absolute right-6 top-6 z-10 rounded-2xl border border-slate-200/20 bg-slate-900/80 px-3 py-2",
        !isToolbar && "shrink-0"
      )}
      style={
        isToolbar ? { maxWidth: "min(100vw - 120px, 320px)" } : undefined
      }
    >
      <div className="flex min-w-0 shrink items-center">
        {visible.map((member) => (
          <div
            key={member.id}
            className="shrink-0"
            style={{ marginLeft: member.id === visible[0]?.id ? 0 : AVATAR_GAP }}
          >
            <MemberAvatar
              member={member}
              isActive={activeUserIds.has(member.id)}
              isFollowed={followingUserId === member.id}
              size={avatarSize}
              variant={variant}
              presenceName={presenceNames[member.id]}
              onClick={onFollowClick ? () => onFollowClick(member.id) : undefined}
            />
          </div>
        ))}
      </div>
      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "ml-1 flex shrink-0 items-center justify-center rounded-full text-xs font-medium",
                isToolbar
                  ? "h-8 w-8 border border-slate-200/40 bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  : "h-7 w-7 border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
              aria-label={`${overflow.length} more members`}
            >
              +{overflow.length}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
            {overflow.map((member) => (
              <DropdownMenuItem
                key={member.id}
                disabled={!activeUserIds.has(member.id) || !onFollowClick}
                onClick={
                  onFollowClick && activeUserIds.has(member.id)
                    ? (e) => {
                        e.preventDefault();
                        onFollowClick(member.id);
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <MemberAvatar
                    member={member}
                    isActive={activeUserIds.has(member.id)}
                    isFollowed={followingUserId === member.id}
                    size={24}
                    variant={variant}
                    presenceName={presenceNames[member.id]}
                  />
                  <span>
                    {member.first_name || member.last_name
                      ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
                      : "Unknown"}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
