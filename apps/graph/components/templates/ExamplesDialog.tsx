"use client";

import { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";
import type { SceneExampleDefinition } from "@/lib/templates/examplesRegistry";

interface ExamplesDialogProps {
  open: boolean;
  examples: SceneExampleDefinition[];
  error: string | null;
  onClose: () => void;
  onOpenExample: (exampleId: string) => void;
}

export default function ExamplesDialog({
  open,
  examples,
  error,
  onClose,
  onOpenExample
}: ExamplesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel w-full max-w-3xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="examples-dialog-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="examples-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Examples
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Open example scenes for surfaces, planes, and parametric curves.
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto px-5 py-4">
          {examples.length === 0 ? (
            <p className="text-[12px] text-[var(--text-tertiary)]">No examples are available.</p>
          ) : (
            <ul className="space-y-2">
              {examples.map((example) => (
                <li key={example.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--text-primary)]">{example.title}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        {example.category} · {example.recommendedMode.toUpperCase()}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{example.description}</p>
                    </div>
                    <button type="button" className="btn btn-primary shrink-0" onClick={() => onOpenExample(example.id)}>
                      Open example
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" data-autofocus="true" onClick={onClose} className="btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
