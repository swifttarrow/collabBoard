"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Undo2, Redo2, Save, FileText, Pencil, History, Trash2 } from "lucide-react";
import { ThemePickerDialog } from "@/components/theme/ThemePickerDialog";
import { KonamiHearts } from "./KonamiHearts";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { toast } from "sonner";
import { useVersionHistoryOptional } from "@/components/version-history/VersionHistoryProvider";
import { DeleteBoardConfirmDialog } from "./DeleteBoardConfirmDialog";
import { deleteBoard } from "@/app/boards/actions";

type Props = {
  boardId: string;
  boardTitle: string;
  isOwner: boolean;
};

export function BoardMenuBar({ boardId, boardTitle, isOwner }: Props) {
  const router = useRouter();
  const vh = useVersionHistoryOptional();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { triggered, reset } = useKonamiCode();
  const handleKonamiComplete = useCallback(() => reset(), [reset]);

  if (!vh) return null;

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    const result = await deleteBoard(boardId);
    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      router.refresh();
      router.push("/boards");
    }
  };

  const handleSave = () => {
    if (vh.save()) {
      vh.recordSaveCheckpoint();
      toast.success("Board saved");
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50/30 px-4 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 data-[state=open]:bg-slate-200/80 dark:text-white dark:hover:bg-slate-700 dark:focus:ring-slate-200 dark:data-[state=open]:bg-slate-700">
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
          {isOwner && (
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete board
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteBoardConfirmDialog
        open={deleteDialogOpen}
        boardTitle={boardTitle}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 data-[state=open]:bg-slate-200/80 dark:text-white dark:hover:bg-slate-700 dark:focus:ring-slate-200 dark:data-[state=open]:bg-slate-700">
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
      <div className="ml-auto flex items-center gap-2">
        {triggered && (
          <KonamiHearts show={triggered} onComplete={handleKonamiComplete} />
        )}
        <ThemePickerDialog />
      </div>
    </div>
  );
}
