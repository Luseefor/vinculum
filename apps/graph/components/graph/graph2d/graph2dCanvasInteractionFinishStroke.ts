import type { Dispatch, SetStateAction } from "react";
import { fitParametricSketch, formatPolynomialExpression } from "@/lib/math/fitParametricSketch";
import type { Axis2DPair } from "@/types/graphUi";
import { SKETCH_MIN_POINTS_TO_FIT } from "./graph2dCanvasConstants";
import type { SketchFitPreview } from "./graph2dCanvasTypes";

export type FinalizeGraph2dSketchStrokeArgs = {
  stroke: { horizontal: number; vertical: number }[];
  sketchAutoCreate: boolean;
  isQuadTop: boolean;
  axis2dPairQuadTop: Axis2DPair;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  setSketchFitPreview: Dispatch<SetStateAction<SketchFitPreview | null>>;
};

/** After pointer-up with a finished stroke: auto-create curve or open fit preview. */
export function finalizeGraph2dSketchStroke(args: FinalizeGraph2dSketchStrokeArgs): void {
  const { stroke, sketchAutoCreate, isQuadTop, axis2dPairQuadTop, addSketchedParametricFromStroke, setSketchFitPreview } =
    args;

  if (stroke.length < SKETCH_MIN_POINTS_TO_FIT) {
    return;
  }

  if (sketchAutoCreate) {
    addSketchedParametricFromStroke(stroke, isQuadTop ? axis2dPairQuadTop : undefined);
    return;
  }

  const fit = fitParametricSketch(stroke);
  if (fit) {
    setSketchFitPreview({
      stroke,
      fit,
      horizontalExpr: formatPolynomialExpression(fit.horizontalCoeffs, "t"),
      verticalExpr: formatPolynomialExpression(fit.verticalCoeffs, "t")
    });
  }
}
