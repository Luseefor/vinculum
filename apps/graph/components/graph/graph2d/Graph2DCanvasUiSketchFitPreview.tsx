"use client";

import { MathExpression } from "@/components/math/MathExpression";
import { Button } from "@/components/ui/button";

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
  pairForCanvas: Axis2DPair;
};

export function Graph2DCanvasUiSketchFitPreview({
  axisPair,
  sketchFitPreview,
  setSketchFitPreview,
  addSketchedParametricFromStroke,
  pairForCanvas
}: Graph2DCanvasUiSketchFitPreviewProps) {
  return (
    <div className="max-w-full rounded-[var(--ui-radius-lg)] border border-(--border-subtle) bg-(--surface-overlay) p-3 text-xs text-(--text-secondary) shadow-(--shadow-floating)">
      <p className="mb-1 text-(--text-primary)">{sketchFitPreview.fit.shape === "freehand" ? "Freehand curve" : `${sketchFitPreview.fit.shape[0].toUpperCase()}${sketchFitPreview.fit.shape.slice(1)} fit`}</p>
      <p>
        <MathExpression expression={`${axisPair.horizontalLabel}(t) = ${sketchFitPreview.horizontalExpr}`} />
      </p>
      <p>
        <MathExpression expression={`${axisPair.verticalLabel}(t) = ${sketchFitPreview.verticalExpr}`} />
      </p>
      <p className="mt-1 text-(--text-tertiary)">
        Maximum deviation {formatCoord(sketchFitPreview.fit.maxError)}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          type="button"
          variant="primary"
          className="editor-control min-h-11 px-3 text-xs"
          onClick={() => {
            addSketchedParametricFromStroke(sketchFitPreview.stroke, pairForCanvas);
            setSketchFitPreview(null);
          }}
        >
          Create
        </Button>
        <button
          type="button"
          className="editor-control min-h-11 rounded-[var(--ui-radius-md)] bg-(--surface-raised) px-3 text-xs text-(--text-secondary)"
          onClick={() => setSketchFitPreview(null)}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
