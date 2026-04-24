"use client";

import { useGraphStore } from "@/store/graphStore";

export default function StatusBar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore(
    (state) => state.scene.objects.filter((object) => object.visible).length
  );
  const selectedId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);

  return (
    <footer className="flex min-h-8 flex-col gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] sm:h-8 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 font-semibold text-[var(--text-secondary)]">
          {graphMode.toUpperCase()}
        </span>
        <span className="shrink-0 rounded border border-[var(--border-subtle)] px-1.5 py-0.5">
          {visibleCount}/{objectCount} visible
        </span>
        {selectedId && (
          <span className="min-w-0 truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[var(--text-secondary)]">
            Selected: {selectedId.slice(0, 8)}
          </span>
        )}
        {graphMode === "2d" && (
          <span className="shrink-0 rounded border border-[var(--border-subtle)] px-1.5 py-0.5">
            Scale: {formatScale(viewport2d.scale)} px/unit
          </span>
        )}
        <span className="shrink-0 rounded border border-[var(--border-subtle)] px-1.5 py-0.5">
          Snap: {snapEnabled ? `On (${snapStep})` : "Off"}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:max-w-[55%] sm:justify-end">
        {graphMode === "3d" ? (
          <>
            {canvas3dTool === "pan" && <span className="shrink-0">Pan: drag</span>}
            {canvas3dTool === "probe" && <span className="shrink-0">Probe: hover + click to pin</span>}
            {canvas3dTool === "draw" && <span className="shrink-0">Sketch: draw on ground plane</span>}
            <span className="shrink-0">Zoom: scroll</span>
            {canvas3dTool === "pan" && <span className="shrink-0">Orbit: alt+drag</span>}
            <span className="hidden min-[520px]:inline">Infinite grid</span>
          </>
        ) : (
          <>
            {canvas2dTool === "pan" && <span className="shrink-0">Pan: drag / touch</span>}
            {canvas2dTool === "probe" && <span className="shrink-0">Probe: crosshair + click to pin</span>}
            {canvas2dTool === "draw" && <span className="shrink-0">Sketch: drag to draw, release to fit</span>}
            <span className="shrink-0">Zoom: scroll</span>
            {canvas2dTool === "pan" && <span className="hidden min-[420px]:inline">Double-click: zoom in</span>}
            <span className="hidden min-[520px]:inline">Esc: clear pin / sketch</span>
          </>
        )}
        <span className="hidden rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[var(--text-secondary)] min-[700px]:inline">
          Hotkeys: 1/2/3/4 views · V pan · P probe · S sketch · Cmd/Ctrl+K or Cmd/Ctrl+Shift+P palette
        </span>
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
