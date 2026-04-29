"use client";

import { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";

interface NewSceneDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NewSceneDialog({ open, onConfirm, onCancel }: NewSceneDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
      data-testid="new-scene-dialog-backdrop"
    >
      <div
        className="panel w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-scene-title"
        data-testid="new-scene-dialog"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="new-scene-title" className="text-sm font-semibold text-[var(--text-primary)]">
            New scene
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            This clears all objects and resets the view. This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onCancel} className="btn">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-primary">
            Create new scene
          </button>
        </div>
      </div>
    </div>
  );
}
