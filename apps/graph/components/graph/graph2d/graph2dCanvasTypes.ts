import type { FitParametricSketchResult } from "@/lib/math/fitParametricSketchTypes";

/** Theme-derived colors for {@link paintGraph2dCanvasFrame}. */
export type Graph2dPaintPalette = {
  background: string;
  gridMinor: string;
  gridMajor: string;
  axis: string;
  axisLabel: string;
  probe: string;
  sketch: string;
};

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  scale: number;
}

export interface MousePosition {
  screen: { x: number; y: number };
  math: { horizontal: number; vertical: number };
}

export interface SketchFitPreview {
  stroke: { horizontal: number; vertical: number }[];
  fit: FitParametricSketchResult;
  horizontalExpr: string;
  verticalExpr: string;
}

export type AxisVariable = "x" | "y" | "z";

export interface AxisPairSpec {
  horizontal: AxisVariable;
  vertical: AxisVariable;
  horizontalLabel: "X" | "Y" | "Z";
  verticalLabel: "X" | "Y" | "Z";
}

export interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

export interface RenderableGraph {
  id: string;
  color: string;
  verticalLineValue: number | null;
  horizontalLineValue: number | null;
  evaluate: ((horizontalValue: number) => number | null) | null;
  implicitEvaluate: ((horizontalValue: number, verticalValue: number) => number | null) | null;
  hatchDomain: { hMin: number; hMax: number; vMin: number; vMax: number } | null;
  polylineHV: ParametricPolyline2D | null;
}

// Canonical 2D parametric data (S5): projected math-frame points plus the
// sampler's segment connectivity. Pure data; no Canvas types. Only the
// parametric path produces non-null values; explicit/implicit paths use the
// other RenderableGraph fields and are unaffected.
export interface ParametricPolyline2D {
  points: Float64Array;
  connectedSegments: Uint8Array;
}
