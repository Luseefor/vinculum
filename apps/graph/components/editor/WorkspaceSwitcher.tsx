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
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--surface-muted)] p-0.5",
        compact ? "h-8" : "h-9"
      )}
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
            "rounded-full font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
            compact ? "h-7 px-2.5 text-[12px]" : "h-8 px-4 text-[13px]",
            // Activation is instant (no fade through low-contrast mid-states);
            // only the inactive hover color animates.
            workspace === entry.id
              ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-control)]"
              : "text-[var(--text-secondary)] transition-colors duration-[var(--motion-fast)] hover:text-[var(--text-primary)] motion-reduce:transition-none"
          )}
        >
          {compact ? COMPACT_SHORT[entry.id] : entry.short}
        </button>
      ))}
    </div>
  );
}
