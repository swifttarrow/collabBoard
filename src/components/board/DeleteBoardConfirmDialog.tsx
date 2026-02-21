"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteBoardConfirmDialogProps = {
  open: boolean;
  boardTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteBoardConfirmDialog({
  open,
  boardTitle,
  onConfirm,
  onCancel,
}: DeleteBoardConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete board?</DialogTitle>
          <DialogDescription>
            &quot;{boardTitle}&quot; and all its objects will be permanently
            deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
