"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore(
    (state) => state.scene.objects.filter((object) => object.visible).length
  );
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);

  return (
    <footer className="flex min-h-[30px] flex-col gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1 text-[10px] text-[var(--text-tertiary)] sm:h-[30px] sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 font-semibold text-[var(--text-secondary)]">
          {graphMode.toUpperCase()}
        </span>
        <span className="shrink-0 rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5">
          {visibleCount} visible
        </span>
        <span className="shrink-0 rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5">
          Snap: {snapEnabled ? `On (${snapStep})` : "Off"}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:max-w-[70%] sm:justify-end">
        <span className="hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[var(--text-secondary)] min-[700px]:inline">
          Hotkeys: 1/2/3/4 views · V pan · P probe · S sketch · X snap · Cmd/Ctrl+K palette
        </span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" />
      </div>
    </footer>
  );
}
