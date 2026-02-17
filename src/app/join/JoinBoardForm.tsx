"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { joinBoardByInviteCode } from "@/app/boards/actions";
import { Button } from "@/components/ui/button";

type Props = { initialCode?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Joining…" : "Join board"}
    </Button>
  );
}

export function JoinBoardForm({ initialCode }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const code = (formData.get("code") as string)?.trim();
        if (!code) {
          setError("Please enter an invite code.");
          return;
        }
        const result = await joinBoardByInviteCode(code);
        if (result?.error) {
          setError(result.error);
        }
      }}
      className="mt-4 space-y-4"
    >
      <div>
        <label htmlFor="invite-code" className="sr-only">
          Invite code
        </label>
        <input
          id="invite-code"
          name="code"
          type="text"
          defaultValue={initialCode ?? ""}
          placeholder="e.g. ab12cd34"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
