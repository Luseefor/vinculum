"use client";

import { formatCoord } from "./graph2dCanvasFormat";
import type { AxisPairSpec } from "./graph2dCanvasTypes";
import type { Viewport2dVisibleRange } from "./graph2dViewportRange";

export type Graph2DCanvasUiViewportRangeBadgeProps = {
  axisPair: AxisPairSpec;
  viewportRange: Viewport2dVisibleRange;
  embedded?: boolean;
};

export function Graph2DCanvasUiViewportRangeBadge({
  axisPair,
  viewportRange,
  embedded = false
}: Graph2DCanvasUiViewportRangeBadgeProps) {
  return (
    <div
      data-testid="graph2d-viewport-range-badge"
      className={
        embedded
          ? "min-w-0 font-mono text-[10px] text-[var(--text-secondary)]"
          : "rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] shadow-lg"
      }
    >
      {axisPair.horizontalLabel}: [{formatCoord(viewportRange.horizontalMin)}, {formatCoord(viewportRange.horizontalMax)}]
      {" · "}
      {axisPair.verticalLabel}: [{formatCoord(viewportRange.verticalMin)}, {formatCoord(viewportRange.verticalMax)}]
    </div>
  );
}
