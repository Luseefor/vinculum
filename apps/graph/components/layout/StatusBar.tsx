"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => 
    state.scene.objects.filter(obj => obj.visible).length
  );
  const selectedId = useGraphStore((state) => state.ui.selectedObjectId);

  return (
    <footer className="h-6 flex items-center justify-between px-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--surface-bg)] border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-4">
        <span>
          {visibleCount}/{objectCount} visible
        </span>
        {selectedId && (
          <span className="text-[var(--text-secondary)]">
            Selected: {selectedId.slice(0, 8)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>Orbit: drag</span>
        <span>Zoom: scroll</span>
        <span>Pan: right-drag</span>
      </div>
    </footer>
  );
}
