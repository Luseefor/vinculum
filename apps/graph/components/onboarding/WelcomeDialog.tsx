"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface WelcomeDialogProps {
  open: boolean;
  error: string | null;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
  onOpenExamples: () => void;
  onStartBlankScene: () => void;
  onContinue: () => void;
  onClose: () => void;
}

export default function WelcomeDialog({
  open,
  error,
  dontShowAgain,
  onDontShowAgainChange,
  onOpenExamples,
  onStartBlankScene,
  onContinue,
  onClose
}: WelcomeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Vinculum</DialogTitle>
          <DialogDescription>Open an example or start a blank scene to begin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <p className="text-[11px] text-[var(--text-secondary)]">
            How to start: switch between 3D and 2D in the viewport header, use Scene actions in the top
            toolbar, edit selected objects in the inspector, open examples for quick setups, then save,
            share, or export from the Scene menu.
          </p>
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.currentTarget.checked)}
              className="h-3.5 w-3.5"
            />
            Don&apos;t show again
          </label>
        </div>

        <DialogFooter className="flex-wrap">
          <Button type="button" variant="secondary" size="sm" onClick={onOpenExamples}>
            Open example
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onStartBlankScene}>
            Start blank scene
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
