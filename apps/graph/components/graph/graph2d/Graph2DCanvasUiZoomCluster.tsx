"use client";

import type { Viewport2D } from "@/types/graphUi";

const btnClass =
  "rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]";

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
    <div className="absolute bottom-3 right-3 z-[24] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 1.25 })}
        className={`h-7 w-7 text-[13px] font-semibold ${btnClass}`}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <span className="text-xs font-semibold">+</span>
      </button>
      <button
        type="button"
        onClick={() => patchViewport2D({ scale: viewport.scale * 0.8 })}
        className={`h-7 w-7 text-[13px] font-semibold ${btnClass}`}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <span className="text-xs font-semibold">−</span>
      </button>
      <button
        type="button"
        onClick={resetViewForCanvas}
        className={`px-2 py-1 text-[11px] font-medium ${btnClass}`}
        title="Reset view"
        aria-label="Reset 2D view"
      >
        Reset
      </button>
    </div>
  );
}
