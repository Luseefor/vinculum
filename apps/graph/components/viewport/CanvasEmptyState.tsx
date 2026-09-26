// S30 canvas-first empty state (Part 18). A minimal center prompt over an
// empty workspace — never a dashboard or tutorial wall. Quick actions create
// through the same central creation path as Quick Add. Rendered only while
// the canonical scene has zero objects; purely presentational otherwise.

"use client";

import { createObjectByKey } from "@/lib/objects/objectCreation";
import { quickAddDescriptors } from "@/lib/objects/objectDescriptors";
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
  const hint =
    workspaceId === "geometry" ? "Add a point, line, surface…" : "Add an expression or mathematical object";

  return (
    // S30: bottom-center, clear of the primary interaction zone (canvas
    // center must keep receiving hover/orbit gestures) and of the Scene
    // chip (bottom-left) and zoom controls (right).
    <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-6 pb-8">
      <div className="pointer-events-auto flex max-w-[300px] flex-col items-center gap-2.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/92 px-4 py-3.5 text-center shadow-sm backdrop-blur-sm">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{hint}</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {actions.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-label={`Create ${entry.label}`}
              onClick={() => createObjectByKey(entry.key)}
              className="h-7 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
