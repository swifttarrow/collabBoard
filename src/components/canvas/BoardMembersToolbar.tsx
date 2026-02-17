"use client";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_VISIBLE_AVATARS = 6;
const AVATAR_SIZE = 32;
const AVATAR_GAP = 4;

export type BoardMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Props = {
  members: BoardMember[];
  activeUserIds: Set<string>;
};

function getInitials(firstName: string | null, lastName: string | null): string {
  if (firstName || lastName) {
    const f = (firstName ?? "").trim().charAt(0).toUpperCase();
    const l = (lastName ?? "").trim().charAt(0).toUpperCase();
    if (f && l) return `${f}${l}`;
    if (f) return f;
    if (l) return l;
  }
  return "U";
}

function hashToColor(userId: string): string {
  const colors = [
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-teal-500",
  ];
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return colors[Math.abs(h) % colors.length];
}

function MemberAvatar({
  member,
  isActive,
  size = AVATAR_SIZE,
}: {
  member: BoardMember;
  isActive: boolean;
  size?: number;
}) {
  const initials = getInitials(member.first_name, member.last_name);
  const colorClass = hashToColor(member.id);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white",
        colorClass,
        isActive && "ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900/80"
      )}
      style={{ width: size, height: size }}
      title={
        member.first_name || member.last_name
          ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
          : "Unknown"
      }
    >
      {initials}
    </div>
  );
}

export function BoardMembersToolbar({ members, activeUserIds }: Props) {

  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = members.slice(MAX_VISIBLE_AVATARS);

  return (
    <div
      className="absolute right-6 top-6 z-10 flex items-center gap-1 rounded-2xl border border-slate-200/20 bg-slate-900/80 px-3 py-2"
      style={{ maxWidth: "min(100vw - 120px, 320px)" }}
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
            />
          </div>
        ))}
      </div>
      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/40 bg-slate-800/80 text-xs font-medium text-slate-300 hover:bg-slate-700/80"
              aria-label={`${overflow.length} more members`}
            >
              +{overflow.length}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
            {overflow.map((member) => (
              <DropdownMenuItem key={member.id} disabled>
                <div className="flex items-center gap-2">
                  <MemberAvatar
                    member={member}
                    isActive={activeUserIds.has(member.id)}
                    size={24}
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
