"use client";

import { useState } from "react";
import { createInviteLink } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = { boardId: string };

export function InviteButton({ boardId }: Props) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (!inviteUrl) {
      setLoading(true);
      const result = await createInviteLink(boardId);
      setLoading(false);
      if (result?.inviteUrl) {
        setInviteUrl(result.inviteUrl);
      }
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="text-slate-600"
        >
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite people to this board</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Share this link with others. Anyone with the link can join the board
          and collaborate in real time.
        </p>
        {loading ? (
          <p className="py-4 text-sm text-slate-500">Generating link…</p>
        ) : inviteUrl ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
