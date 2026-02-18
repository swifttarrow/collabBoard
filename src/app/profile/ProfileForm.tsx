"use client";

import { useActionState, useState } from "react";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { AVATAR_COLORS, getAvatarColorFallback } from "@/lib/avatar-colors";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  defaultFirstName: string;
  defaultLastName: string;
  defaultAvatarColor: string | null;
};

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

export function ProfileForm({
  email,
  defaultFirstName,
  defaultLastName,
  defaultAvatarColor,
}: Props) {
  const [state, formAction] = useActionState(updateProfile, {});
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [avatarColor, setAvatarColor] = useState(
    defaultAvatarColor ?? getAvatarColorFallback(email)
  );

  const initials = getHeaderInitials(email, firstName, lastName);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label
        htmlFor="email"
        className="block text-sm font-medium text-slate-700"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        disabled
        className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 opacity-90"
      />
      <label
        htmlFor="firstName"
        className="block text-sm font-medium text-slate-700"
      >
        First name
      </label>
      <input
        id="firstName"
        name="firstName"
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Optional"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <label
        htmlFor="lastName"
        className="block text-sm font-medium text-slate-700"
      >
        Last name
      </label>
      <input
        id="lastName"
        name="lastName"
        type="text"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Optional"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <label className="block text-sm font-medium text-slate-700">
        Avatar color
      </label>
      <div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setAvatarColor(color)}
            className={cn(
              "h-10 w-10 rounded-full transition-all",
              avatarColor === color
                ? "ring-2 ring-slate-900 ring-offset-2"
                : "hover:ring-2 hover:ring-slate-300 hover:ring-offset-2"
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            aria-pressed={avatarColor === color}
          />
        ))}
      </div>
      <input
        type="hidden"
        name="avatarColor"
        value={avatarColor}
      />
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <p className="text-sm text-slate-500">Preview</p>
      </div>
      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600">Profile updated.</p>
      )}
      <Button type="submit">Save</Button>
    </form>
  );
}
