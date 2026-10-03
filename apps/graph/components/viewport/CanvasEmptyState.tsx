// S30 canvas-first empty state (Part 18). A minimal center prompt over an
// empty workspace — never a dashboard or tutorial wall. Quick actions create
// through the same central creation path as Quick Add. Rendered only while
// the canonical scene has zero objects; purely presentational otherwise.

"use client";

import { createObjectByKey } from "@/lib/objects/objectCreation";
import { descriptorByKey } from "@/lib/objects/objectDescriptors";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import { useGraphStore } from "@/store/graphStore";
import type { WorkspaceId } from "@/types/graphUi";

// workspaceId: the workspace this canvas host belongs to. Both workspace
// hosts stay mounted (visited workspaces are hidden, not unmounted), so the
// prompt must render only for the ACTIVE workspace — never in a hidden host.
export default function CanvasEmptyState({ workspaceId, onOpenGuide, onOpenExamples }: { workspaceId: WorkspaceId; onOpenGuide?: () => void; onOpenExamples?: () => void }) {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const workspace = useGraphStore((state) => state.ui.workspace);

  if (workspace !== workspaceId || objectCount > 0) {
    return null;
  }

  const starters = workspaceId === "geometry"
    ? [{ key: "point", hint: "Coordinates" }, { key: "line", hint: "Point + direction" }, { key: "surface", hint: "z = f(x, y)" }]
    : [{ key: "surface", hint: "z = f(x, y)" }, { key: "parametricCurve", hint: "Path in space" }, { key: "vectorField-2d", hint: "Arrows + flow" }];
  const actions = starters.flatMap((starter) => {
    const entry = descriptorByKey(starter.key);
    return entry ? [{ ...entry, hint: starter.hint }] : [];
  });
  const hint = WORKSPACE_CONTENT[workspaceId].emptyHint;

  return (
    // S30/S35: bottom-center, clear of the primary interaction zone and of
    // first-run tips (top). Scene chip stays bottom-left; zoom stays right.
    // Stacks above the 2D pane overlays (z-[24]) so the actions stay clickable
    // in narrow split panes.
    <div className="pointer-events-none absolute inset-0 z-[25] flex items-end justify-center p-3 pb-8 pr-16">
      <div data-testid="canvas-empty-state" className="pointer-events-auto flex max-h-[45%] w-full max-w-[420px] overflow-y-auto flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-overlay)] px-4 py-4 text-center shadow-[var(--shadow-floating)]">
        <p className="text-[14px] font-medium text-[var(--text-primary)]">{hint}</p>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
          {actions.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-label={`Create ${entry.label}`}
              onClick={() => createObjectByKey(entry.key)}
              className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-2 py-2 text-[12px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {entry.label}
              <span className="mt-1 text-[11px] font-normal text-[var(--text-secondary)]">{entry.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{workspaceId === "math" ? "Type any Cartesian equation in the blank input in Objects, or choose a starter below. Use Inspector for analysis." : "Choose a starter, then edit its row in Objects. Use Inspector for properties and analysis."}</p>
        {onOpenGuide || onOpenExamples ? <div className="flex flex-wrap justify-center gap-2">
          {onOpenGuide ? <button type="button" onClick={(event) => { event.currentTarget.focus(); onOpenGuide(); }} className="rounded-full px-3 py-2 text-[12px] font-medium text-[var(--accent-ink)] outline-none hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Where are the tools?</button> : null}
          {onOpenExamples ? <button type="button" onClick={onOpenExamples} className="rounded-full px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Browse examples</button> : null}
        </div> : null}
      </div>
    </div>
  );
}
