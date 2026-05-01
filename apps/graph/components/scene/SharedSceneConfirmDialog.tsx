"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SharedSceneConfirmDialogProps {
  open: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SharedSceneConfirmDialog({
  open,
  error,
  onConfirm,
  onCancel
}: SharedSceneConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onCancel()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open shared scene?</DialogTitle>
          <DialogDescription>
            This replaces the current scene. Save your work first if you want to keep it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" data-autofocus="true" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
            Open shared scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
