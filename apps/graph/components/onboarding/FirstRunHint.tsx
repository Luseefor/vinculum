// First-run tips live inside the shared start panel. Details keep the full
// create/edit/analyze guidance available without a second floating card.
// Dismissal is a UI preference only; never mutates the scene.

"use client";

import { ChevronDownIcon } from "@/components/layout/icons";
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
  onDismiss
}: FirstRunHintProps) {
  if (!open) return null;
  const copy = firstRunCopy(workspace);

  return (
    <aside data-testid="first-run-hint" aria-label="Getting started" className="canvas-start-tips">
      <details>
        <summary>Quick tips <ChevronDownIcon className="h-3.5 w-3.5" /></summary>
        <div className="canvas-start-tips-body">
          <p className="font-medium text-(--text-primary)">{copy.title}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-4">
            {copy.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
          <p className="mt-3">{canvasNavHint(canvasMode, touchHints)}</p>
        </div>
      </details>
      <button type="button" onClick={event => {
        // Keep keyboard focus in the launcher when this inline tip disappears.
        event.currentTarget.closest('[data-testid="canvas-empty-state"]')?.querySelector<HTMLButtonElement>('[data-start-primary]')?.focus();
        onDismiss();
      }}>Got it</button>
      {error ? <p role="alert" className="status-callout" data-tone="warning">{error}</p> : null}
    </aside>
  );
}
