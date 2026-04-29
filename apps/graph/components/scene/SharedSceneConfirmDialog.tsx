"use client";

import { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[67] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="panel w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-scene-confirm-title"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="shared-scene-confirm-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Open shared scene?
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            This replaces the current scene. Save your work first if you want to keep it.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" data-autofocus="true" onClick={onCancel} className="btn">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-primary">
            Open shared scene
          </button>
        </div>
      </div>
    </div>
  );
}
