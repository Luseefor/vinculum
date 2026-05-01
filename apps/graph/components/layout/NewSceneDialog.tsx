"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NewSceneDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NewSceneDialog({ open, onConfirm, onCancel }: NewSceneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        className="max-w-md"
        contentTestId="new-scene-dialog"
        backdropTestId="new-scene-dialog-backdrop"
        backdropProps={{ role: "presentation" }}
      >
        <DialogHeader>
          <DialogTitle>New scene</DialogTitle>
          <DialogDescription className="leading-relaxed">
            This clears all objects and resets the view. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} data-autofocus="true">
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
            Create new scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
