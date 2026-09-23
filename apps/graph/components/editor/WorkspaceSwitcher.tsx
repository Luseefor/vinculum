"use client";

import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import type { WorkspaceId } from "@/types/graphUi";

const WORKSPACES: Array<{ id: WorkspaceId; short: string; label: string; title: string }> = [
  { id: "geometry", short: "Geometry", label: "Geometry Studio", title: "Geometry Studio — spatial objects" },
  { id: "math", short: "Math Lab", label: "Math Lab", title: "Math Lab — equations and analysis" }
];

/**
 * Compact workspace switcher. UI organization only: switching never touches
 * the canonical scene, selection, cameras, or view state.
 */
export default function WorkspaceSwitcher() {
  const workspace = useGraphStore((state) => state.ui.workspace);
  const setWorkspace = useGraphStore((state) => state.setWorkspace);

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-transparent p-0.5"
      role="group"
      aria-label="Workspace"
    >
      {WORKSPACES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={workspace === entry.id}
          aria-label={entry.label}
          title={entry.title}
          onClick={() => setWorkspace(entry.id)}
          className={cn(
            "h-7 rounded-[5px] px-2 text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
            workspace === entry.id
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text-primary)]"
          )}
        >
          {entry.short}
        </button>
      ))}
    </div>
  );
}
