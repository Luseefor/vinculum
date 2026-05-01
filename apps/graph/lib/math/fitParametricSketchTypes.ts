export interface FitParametricSketchResult {
  horizontalCoeffs: number[];
  verticalCoeffs: number[];
  degree: number;
  maxError: number;
}

export interface FitParametricSketch3DResult {
  xCoeffs: number[];
  yCoeffs: number[];
  zCoeffs: number[];
  degree: number;
  maxError: number;
}
