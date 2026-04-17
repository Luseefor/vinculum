"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => 
    state.scene.objects.filter(obj => obj.visible).length
  );
  const selectedId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const viewport2dFrame = useGraphStore((state) => state.ui.viewport2dFrame);
  const xMin = viewport2d.centerX - viewport2dFrame.width / (2 * viewport2d.scale);
  const xMax = viewport2d.centerX + viewport2dFrame.width / (2 * viewport2d.scale);
  const yMin = viewport2d.centerY - viewport2dFrame.height / (2 * viewport2d.scale);
  const yMax = viewport2d.centerY + viewport2dFrame.height / (2 * viewport2d.scale);
  const axisLabels = getAxisPairLabels(axis2dPair);

  return (
    <footer className="flex h-7 items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-[10px] text-[var(--text-tertiary)]">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 font-semibold text-[var(--text-secondary)]">
          {graphMode.toUpperCase()}
        </span>
        <span>
          {visibleCount}/{objectCount} visible
        </span>
        {selectedId && (
          <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[var(--text-secondary)]">
            Selected: {selectedId.slice(0, 8)}
          </span>
        )}
        {graphMode === "2d" && (
          <span>
            Scale: {formatScale(viewport2d.scale)} px/unit
          </span>
        )}
        {graphMode === "2d" && viewport2dFrame.width > 0 && viewport2dFrame.height > 0 && (
          <>
            <span>{axisLabels.horizontal}: [{formatRange(xMin)}, {formatRange(xMax)}]</span>
            <span>{axisLabels.vertical}: [{formatRange(yMin)}, {formatRange(yMax)}]</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {graphMode === "3d" ? (
          <>
            <span>Orbit: drag</span>
            <span>Zoom: scroll</span>
            <span>Pan: right-drag</span>
            <span>Infinite grid</span>
          </>
        ) : (
          <>
            <span>Pan: drag</span>
            <span>Zoom: scroll</span>
            <span>Double-click: zoom in</span>
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

function getAxisPairLabels(pair: "xy" | "yz" | "xz"): { horizontal: "X" | "Y" | "Z"; vertical: "X" | "Y" | "Z" } {
  if (pair === "yz") {
    return { horizontal: "Y", vertical: "Z" };
  }
  if (pair === "xz") {
    return { horizontal: "X", vertical: "Z" };
  }
  return { horizontal: "X", vertical: "Y" };
}
