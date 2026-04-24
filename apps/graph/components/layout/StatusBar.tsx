"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore(
    (state) => state.scene.objects.filter((object) => object.visible).length
  );
  const selectedId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);

  return (
    <footer className="flex min-h-7 flex-col gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] sm:h-7 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="shrink-0 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 font-semibold text-[var(--text-secondary)]">
          {graphMode.toUpperCase()}
        </span>
        <span className="shrink-0">
          {visibleCount}/{objectCount} visible
        </span>
        {selectedId && (
          <span className="min-w-0 truncate rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[var(--text-secondary)]">
            Selected: {selectedId.slice(0, 8)}
          </span>
        )}
        {graphMode === "2d" && (
          <span className="shrink-0">
            Scale: {formatScale(viewport2d.scale)} px/unit
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:max-w-[55%] sm:justify-end">
        {graphMode === "3d" ? (
          <>
            <span className="shrink-0">Orbit: drag</span>
            <span className="shrink-0">Zoom: scroll</span>
            <span className="shrink-0">Pan: right-drag</span>
            <span className="hidden min-[520px]:inline">Infinite grid</span>
          </>
        ) : (
          <>
            <span className="shrink-0">Pan: drag / touch</span>
            <span className="shrink-0">Zoom: scroll</span>
            <span className="hidden min-[420px]:inline">Double-click: zoom in</span>
          </>
        )}
      </div>
    </footer>
  );
}

function formatScale(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  if (value >= 1000 || value < 0.01) {
    return value.toExponential(2);
  }

  if (value < 1) {
    return value.toFixed(3);
  }

  if (value < 10) {
    return value.toFixed(2);
  }

  return value.toFixed(1);
}
