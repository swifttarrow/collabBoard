"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";

type Props = {
  defaultFirstName: string;
  defaultLastName: string;
};

export function ProfileForm({ defaultFirstName, defaultLastName }: Props) {
  const [state, formAction] = useActionState(updateProfile, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
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
        defaultValue={defaultFirstName}
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
        defaultValue={defaultLastName}
        placeholder="Optional"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
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
