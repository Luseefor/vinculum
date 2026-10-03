// S35 first-run onboarding — non-blocking contextual card.
// Teaches Geometry vs Math, create, edit, Analyze, and canvas navigation.
// Dismissal is a UI preference only; never mutates the scene.

"use client";

import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import type { WorkspaceId } from "@/types/graphUi";

export interface FirstRunHintProps {
  open: boolean;
  workspace: WorkspaceId;
  error: string | null;
  /** Coarse pointer / touch: use touch canvas copy. */
  touchHints?: boolean;
  /** Ortho geometry pan vs perspective orbit. */
  canvasMode?: "perspective" | "ortho" | "math";
  onDismiss: () => void;
  onOpenExamples: () => void;
  onOpenGuide?: () => void;
}

export function firstRunCopy(workspace: WorkspaceId): {
  title: string;
  steps: string[];
} {
  if (workspace === "geometry") {
    return {
      title: WORKSPACE_CONTENT.geometry.label,
      steps: [
        "Use Objects → Add to create a point, line, or surface.",
        "Click an object row to edit. Inspector changes its properties.",
        "Select an object → Inspector → Analyze for distances and angles."
      ]
    };
  }
  return {
    title: WORKSPACE_CONTENT.math.label,
    steps: [
      "Type an equation in Objects: x=y^2 is 2D; add z for 3D.",
      "Click an expression row to edit its formula.",
      "Use Solve for field problems; Inspector → Analyze for a selected object."
    ]
  };
}

export function canvasNavHint(
  canvasMode: FirstRunHintProps["canvasMode"],
  touchHints: boolean
): string {
  if (touchHints) {
    return "Drag to move the view · Pinch to zoom";
  }
  if (canvasMode === "math") return "3D: drag to orbit · 2D: drag to pan · Scroll to zoom";
  if (canvasMode === "ortho") {
    return "Drag to pan · Scroll to zoom";
  }
  return "Drag to orbit · Scroll to zoom";
}

export default function FirstRunHint({
  open,
  workspace,
  error,
  touchHints = false,
  canvasMode = "perspective",
  onDismiss,
  onOpenExamples,
  onOpenGuide
}: FirstRunHintProps) {
  if (!open) {
    return null;
  }

  const copy = firstRunCopy(workspace);
  const nav = canvasNavHint(canvasMode, touchHints);

  return (
    <aside
      data-testid="first-run-hint"
      aria-label="Getting started"
      className="pointer-events-auto absolute left-1/2 top-4 z-20 w-[min(22rem,calc(100%-1.5rem))] max-h-[calc(50%_-_2rem)] -translate-x-1/2 overflow-y-auto animate-fade-in rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-3.5 shadow-[var(--shadow-floating)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            {copy.title}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            Geometry Studio and Math Lab share one scene.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started tips"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        >
          <span aria-hidden="true" className="text-[16px] leading-none">
            ×
          </span>
        </button>
      </div>

      <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-[12px] leading-snug text-[var(--text-secondary)]">
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <p className="mt-2.5 text-[11px] text-[var(--text-tertiary)]">{nav}</p>

      {error ? (
        <p
          role="alert"
          className="status-callout mt-2"
          data-tone="warning"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {onOpenGuide ? <button type="button" onClick={(event) => { event.currentTarget.focus(); onOpenGuide(); }} className="h-8 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-2.5 text-[12px] font-medium text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Where are the tools?</button> : null}
        <button
          type="button"
          onClick={onOpenExamples}
          className="h-8 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        >
          Open example
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-8 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 text-[12px] font-medium text-[var(--accent-ink)] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
