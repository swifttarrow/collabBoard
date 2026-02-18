"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AVATAR_SIZE = 32;

function getHeaderInitials(
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

import { getAvatarColorFallback } from "@/lib/avatar-colors";

type Props = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarColor?: string | null;
};

export function UserMenu({ email, firstName, lastName, avatarColor }: Props) {
  const initials = getHeaderInitials(email, firstName ?? null, lastName ?? null);
  const color = avatarColor ?? getAvatarColorFallback(email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          aria-label="User menu"
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, backgroundColor: color }}
          >
            {initials}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <Link href="/profile" prefetch={false}>Profile</Link>
        </DropdownMenuItem>
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-default text-left">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
