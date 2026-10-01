// S30 canvas-first empty state (Part 18). A minimal center prompt over an
// empty workspace — never a dashboard or tutorial wall. Quick actions create
// through the same central creation path as Quick Add. Rendered only while
// the canonical scene has zero objects; purely presentational otherwise.

"use client";

import { createObjectByKey } from "@/lib/objects/objectCreation";
import { quickAddDescriptors } from "@/lib/objects/objectDescriptors";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import { useGraphStore } from "@/store/graphStore";
import type { WorkspaceId } from "@/types/graphUi";

// workspaceId: the workspace this canvas host belongs to. Both workspace
// hosts stay mounted (visited workspaces are hidden, not unmounted), so the
// prompt must render only for the ACTIVE workspace — never in a hidden host.
export default function CanvasEmptyState({ workspaceId }: { workspaceId: WorkspaceId }) {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const workspace = useGraphStore((state) => state.ui.workspace);

  if (workspace !== workspaceId || objectCount > 0) {
    return null;
  }

  const actions = quickAddDescriptors(workspaceId).slice(0, 3);
  const hint = WORKSPACE_CONTENT[workspaceId].emptyHint;

  return (
    // S30/S35: bottom-center, clear of the primary interaction zone and of
    // first-run tips (top). Scene chip stays bottom-left; zoom stays right.
    // Stacks above the 2D pane overlays (z-[24]) so the actions stay clickable
    // in narrow split panes.
    <div className="pointer-events-none absolute inset-0 z-[25] flex items-end justify-center p-6 pb-8">
      <div className="pointer-events-auto flex max-w-[320px] flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-5 py-4 text-center shadow-[var(--shadow-floating)]">
        <p className="text-[14px] font-medium text-[var(--text-primary)]">{hint}</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {actions.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-label={`Create ${entry.label}`}
              onClick={() => createObjectByKey(entry.key)}
              className="h-8 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-control)] outline-none transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
