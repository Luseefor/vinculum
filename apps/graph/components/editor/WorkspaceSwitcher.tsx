"use client";

import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import type { WorkspaceId } from "@/types/graphUi";

// S30: one canonical naming system — visible text matches the accessible
// name everywhere (Geometry Studio / Math Lab).
const WORKSPACES: Array<{ id: WorkspaceId; short: string; label: string; title: string }> = [
  { id: "geometry", short: "Geometry Studio", label: "Geometry Studio", title: "Geometry Studio — spatial objects" },
  { id: "math", short: "Math Lab", label: "Math Lab", title: "Math Lab — equations and analysis" }
];

// S34 PART 15: compact short text ("Geometry") with the full accessible
// label preserved for screen readers.
const COMPACT_SHORT: Record<WorkspaceId, string> = {
  geometry: "Geometry",
  math: "Math Lab"
};

/**
 * Compact workspace switcher. UI organization only: switching never touches
 * the canonical scene, selection, cameras, or view state.
 */
export default function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
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
            "h-7 rounded-[var(--radius-sm)] px-2 text-[11px] font-semibold outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
            workspace === entry.id
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text-primary)]"
          )}
        >
          {compact ? COMPACT_SHORT[entry.id] : entry.short}
        </button>
      ))}
    </div>
  );
}
