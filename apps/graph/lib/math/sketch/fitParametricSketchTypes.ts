export interface FitParametricSketchResult {
  horizontalExpr: string;
  verticalExpr: string;
  shape: "line" | "parabola" | "cubic" | "circle" | "polynomial" | "freehand";
  horizontalCoeffs: number[];
  verticalCoeffs: number[];
  degree: number;
  maxError: number;
}

export interface FitParametricSketch3DResult {
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  xCoeffs: number[];
  yCoeffs: number[];
  zCoeffs: number[];
  degree: number;
  maxError: number;
}
