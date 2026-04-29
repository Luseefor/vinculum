"use client";

import { useEffect, useRef } from "react";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, input[type="checkbox"], [href], [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[68] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="panel w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="welcome-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Welcome to Vinculum
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Open an example or start a blank scene to begin.
          </p>
        </div>

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

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onOpenExamples} className="btn">
            Open example
          </button>
          <button type="button" onClick={onStartBlankScene} className="btn">
            Start blank scene
          </button>
          <button type="button" onClick={onContinue} className="btn btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
