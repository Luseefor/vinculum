"use client";

import type { Viewport2D } from "@/types/graphUi";

const btnClass =
  "rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]";

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
    <div className="absolute bottom-11 right-3 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 1.25 })}
        className={`h-7 w-7 ${btnClass}`}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <span className="text-xs font-semibold">+</span>
      </button>
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 0.8 })}
        className={`h-7 w-7 ${btnClass}`}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <span className="text-xs font-semibold">−</span>
      </button>
      <button
        type="button"
        onClick={resetViewForCanvas}
        className={`px-2 py-1 text-[10px] ${btnClass}`}
        title="Reset view"
        aria-label="Reset 2D view"
      >
        Reset
      </button>
    </div>
  );
}
