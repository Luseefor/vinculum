"use client";

import { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDiscard();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDiscard, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm" onClick={onDiscard}>
      <div
        className="panel w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-dialog-title"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="recovery-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Restore unsaved scene?
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Unsaved scene data was found from {updatedAt ? new Date(updatedAt).toLocaleString() : "a previous session"}.
          </p>
        </div>
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
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" data-autofocus="true" onClick={onDiscard} className="btn">
            Discard
          </button>
          <button type="button" onClick={onRestore} className="btn btn-primary">
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
