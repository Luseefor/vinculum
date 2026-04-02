"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => 
    state.scene.objects.filter(obj => obj.visible).length
  );
  const selectedId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const viewport2dFrame = useGraphStore((state) => state.ui.viewport2dFrame);
  const xMin = viewport2d.centerX - viewport2dFrame.width / (2 * viewport2d.scale);
  const xMax = viewport2d.centerX + viewport2dFrame.width / (2 * viewport2d.scale);
  const yMin = viewport2d.centerY - viewport2dFrame.height / (2 * viewport2d.scale);
  const yMax = viewport2d.centerY + viewport2dFrame.height / (2 * viewport2d.scale);

  return (
    <footer className="h-6 flex items-center justify-between px-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--surface-bg)] border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-4">
        <span className="text-[var(--text-secondary)] font-medium">
          {graphMode.toUpperCase()}
        </span>
        <span>
          {visibleCount}/{objectCount} visible
        </span>
        {selectedId && (
          <span className="text-[var(--text-secondary)]">
            Selected: {selectedId.slice(0, 8)}
          </span>
        )}
        {graphMode === "2d" && (
          <span>
            Scale: {viewport2d.scale.toFixed(0)}px/unit
          </span>
        )}
        {graphMode === "2d" && viewport2dFrame.width > 0 && viewport2dFrame.height > 0 && (
          <>
            <span>X: [{formatRange(xMin)}, {formatRange(xMax)}]</span>
            <span>Y: [{formatRange(yMin)}, {formatRange(yMax)}]</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {graphMode === "3d" ? (
          <>
            <span>Orbit: drag</span>
            <span>Zoom: scroll</span>
            <span>Pan: right-drag</span>
          </>
        ) : (
          <>
            <span>Pan: drag</span>
            <span>Zoom: scroll</span>
          </>
        )}
      </div>
    </footer>
  );
}

function formatRange(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) {
    return value.toExponential(1);
  }
  return value.toFixed(2);
}
