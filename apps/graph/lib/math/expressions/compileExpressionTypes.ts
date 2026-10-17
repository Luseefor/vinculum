export type SurfaceEvaluator = (u: number, v: number) => number;

export interface CompiledSurfaceExpression {
  evaluator: SurfaceEvaluator;
  error: string | null;
  /** Orientation used for f(u,v) sampling (equation wins over UI when the equation starts with x=, y=, or z=). */
  effectiveOrientation: "x" | "y" | "z";
}
