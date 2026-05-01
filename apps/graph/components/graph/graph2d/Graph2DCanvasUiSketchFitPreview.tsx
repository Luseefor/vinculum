"use client";

import type { Axis2DPair } from "@/types/graphUi";
import { formatCoord } from "./graph2dCanvasFormat";
import type { AxisPairSpec, SketchFitPreview } from "./graph2dCanvasTypes";

export type Graph2DCanvasUiSketchFitPreviewProps = {
  axisPair: AxisPairSpec;
  sketchFitPreview: SketchFitPreview;
  setSketchFitPreview: (v: SketchFitPreview | null) => void;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  isQuadTop: boolean;
  axis2dPairQuadTop: Axis2DPair;
};

export function Graph2DCanvasUiSketchFitPreview({
  axisPair,
  sketchFitPreview,
  setSketchFitPreview,
  addSketchedParametricFromStroke,
  isQuadTop,
  axis2dPairQuadTop
}: Graph2DCanvasUiSketchFitPreviewProps) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2 font-mono text-[10px] text-[var(--text-secondary)] shadow-lg">
      <p className="mb-1 text-[var(--text-primary)]">Sketch fit preview</p>
      <p>
        {axisPair.horizontalLabel}(t): {sketchFitPreview.horizontalExpr}
      </p>
      <p>
        {axisPair.verticalLabel}(t): {sketchFitPreview.verticalExpr}
      </p>
      <p className="mt-1 text-[var(--text-tertiary)]">
        degree {sketchFitPreview.fit.degree} · max error {formatCoord(sketchFitPreview.fit.maxError)}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-bg)]"
          onClick={() => {
            addSketchedParametricFromStroke(sketchFitPreview.stroke, isQuadTop ? axis2dPairQuadTop : undefined);
            setSketchFitPreview(null);
          }}
        >
          Create
        </button>
        <button
          type="button"
          className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]"
          onClick={() => setSketchFitPreview(null)}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
