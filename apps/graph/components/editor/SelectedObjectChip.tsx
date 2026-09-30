// S34 PART 22: compact selected-object chip — a small contextual affordance
// showing what is selected and opening the Inspector sheet. Canvas-first
// composition: no floating definition cards, no permanent mini object list.

"use client";

import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import { useGraphStore } from "@/store/graphStore";

export default function SelectedObjectChip({
  objectId,
  onInspect
}: {
  objectId: string;
  onInspect: () => void;
}) {
  const objects = useGraphStore((state) => state.scene.objects);
  const index = objects.findIndex((candidate) => candidate.id === objectId);
  const object = index >= 0 ? objects[index] : null;
  if (!object) {
    return null;
  }
  const meta = getObjectRowDisplayMeta(object);
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-[11] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] py-1 pl-3 pr-1 shadow-sm">
      <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)]">
        {meta.label} #{index + 1}
      </span>
      <button
        type="button"
        onClick={onInspect}
        aria-label={`Inspect ${meta.label} ${index + 1}`}
        className="flex h-10 shrink-0 items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--accent-ink)] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        Inspect
      </button>
    </div>
  );
}
