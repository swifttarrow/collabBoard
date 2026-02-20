"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Undo2, Redo2, Save, FileText, Pencil, History } from "lucide-react";
import { toast } from "sonner";
import { useVersionHistoryOptional } from "@/components/version-history/VersionHistoryProvider";

type Props = {
  boardTitle: string;
};

export function BoardMenuBar({ boardTitle }: Props) {
  const vh = useVersionHistoryOptional();
  if (!vh) return null;

  const handleSave = () => {
    if (vh.save()) {
      vh.recordSaveCheckpoint();
      toast.success("Board saved");
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50/30 px-4 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 data-[state=open]:bg-slate-200/80">
          <FileText className="h-4 w-4" />
          File
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          <DropdownMenuItem onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => vh.setOpenHistoryPanel(!vh.openHistoryPanel)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {vh.openHistoryPanel ? "Close version history" : "Version history"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 data-[state=open]:bg-slate-200/80">
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          <DropdownMenuItem
            onClick={() => vh.undo()}
            disabled={!vh.canUndo}
            className="gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Undo
            <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => vh.redo()}
            disabled={!vh.canRedo}
            className="gap-2"
          >
            <Redo2 className="h-4 w-4" />
            Redo
            <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
