"use client";

import { MathExpression } from "@/components/math/MathExpression";

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
    <div className="max-w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-3 text-xs text-[var(--text-secondary)] shadow-[var(--shadow-floating)]">
      <p className="mb-1 text-[var(--text-primary)]">{sketchFitPreview.fit.shape === "freehand" ? "Freehand curve" : `${sketchFitPreview.fit.shape[0].toUpperCase()}${sketchFitPreview.fit.shape.slice(1)} fit`}</p>
      <p>
        <MathExpression expression={`${axisPair.horizontalLabel}(t) = ${sketchFitPreview.horizontalExpr}`} />
      </p>
      <p>
        <MathExpression expression={`${axisPair.verticalLabel}(t) = ${sketchFitPreview.verticalExpr}`} />
      </p>
      <p className="mt-1 text-[var(--text-tertiary)]">
        Maximum deviation {formatCoord(sketchFitPreview.fit.maxError)}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          className="editor-control min-h-11 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-xs font-medium text-white"
          onClick={() => {
            addSketchedParametricFromStroke(sketchFitPreview.stroke, isQuadTop ? axis2dPairQuadTop : undefined);
            setSketchFitPreview(null);
          }}
        >
          Create
        </button>
        <button
          type="button"
          className="editor-control min-h-11 rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 text-xs text-[var(--text-secondary)]"
          onClick={() => setSketchFitPreview(null)}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
