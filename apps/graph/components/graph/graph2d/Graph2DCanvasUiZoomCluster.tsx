"use client";

import type { Viewport2D } from "@/types/graphUi";

const btnClass =
  "flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export type Graph2DCanvasUiZoomClusterProps = {
  viewport: Pick<Viewport2D, "scale">;
  patchViewport2D: (patch: { scale?: number; centerX?: number; centerY?: number }) => void;
  resetViewForCanvas: () => void;
};

export function Graph2DCanvasUiZoomCluster({
  viewport,
  patchViewport2D,
  resetViewForCanvas
}: Graph2DCanvasUiZoomClusterProps) {
  return (
    <div className="absolute bottom-3 right-3 z-[24] flex flex-col items-stretch gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-0.5 shadow-[var(--shadow-control)]">
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 1.25 })}
        className={`h-8 w-9 text-[15px] ${btnClass}`}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 0.8 })}
        className={`h-8 w-9 text-[15px] ${btnClass}`}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        onClick={resetViewForCanvas}
        className={`h-7 border-t border-[var(--border-subtle)] px-1 text-[11px] font-medium ${btnClass}`}
        title="Reset view"
        aria-label="Reset 2D view"
      >
        Reset
      </button>
    </div>
  );
}
