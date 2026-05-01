"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RecoveryDialogProps {
  open: boolean;
  updatedAt: string | null;
  error: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function RecoveryDialog({
  open,
  updatedAt,
  error,
  onRestore,
  onDiscard
}: RecoveryDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onDiscard()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restore unsaved scene?</DialogTitle>
          <DialogDescription>
            Unsaved scene data was found from {updatedAt ? new Date(updatedAt).toLocaleString() : "a previous session"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Restore to continue from the recovered scene, or discard to start with the current session.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" data-autofocus="true" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onRestore}>
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
