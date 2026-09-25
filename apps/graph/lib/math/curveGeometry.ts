import { compileParametricCurveExpressions } from "./compileParametric";
import { compilePartialDerivative } from "./compilePartialDerivative";

// S25 curve differential geometry for parametric curves r(t) =
// <x(t), y(t), z(t)>. Position comes from the explicit-params S25 curve
// compiler; first derivatives come from the S21 symbolic core
// (compilePartialDerivative with "t" explicitly allowed — the derivative
// gate verified this path needs no S11 weakening). No finite
// differences, ever. Worker-safe: explicit params throughout, no store.
//
// Contract at t: r(t) finite AND r'(t) finite, otherwise the integrand
// evaluation at t is unavailable (fail closed). A stationary point
// (r'(t) = 0) is valid with speed contribution 0 — never classified as
// an invalid curve.

export interface CompiledCurveGeometry {
  evaluate: (t: number) => [number, number, number];
  derivative: (t: number) => [number, number, number];
  speed: (t: number) => number;
  error: string | null;
}

const NAN_TRIPLE: [number, number, number] = [Number.NaN, Number.NaN, Number.NaN];

function finiteTriple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const triple = value as unknown[];
  if (triple.some((component) => typeof component !== "number" || !Number.isFinite(component))) {
    return null;
  }
  return triple as [number, number, number];
}

export function compileCurveGeometry(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  params: Record<string, number>
): CompiledCurveGeometry {
  const position = compileParametricCurveExpressions(xExpr, yExpr, zExpr, params);
  if (position.error) {
    return { evaluate: () => [...NAN_TRIPLE], derivative: () => [...NAN_TRIPLE], speed: () => Number.NaN, error: position.error };
  }
  const allowedSymbols = [...Object.keys(params), "t"];
  const axes: Array<[string, string]> = [
    [xExpr, "x"],
    [yExpr, "y"],
    [zExpr, "z"]
  ];
  const partials = axes.map(([expr]) =>
    compilePartialDerivative({ expression: expr, variable: "t", allowedSymbols, params })
  );
  const failed = partials.find((partial) => partial.error !== null);
  if (failed?.error) {
    // S21/S22 unsupported-derivative policy: the source curve stays
    // valid/renderable; analysis reports unavailable (PART 30).
    return {
      evaluate: (t) => position.evaluator(t),
      derivative: () => [...NAN_TRIPLE],
      speed: () => Number.NaN,
      error: failed.error
    };
  }
  if (partials.length !== 3) {
    return {
      evaluate: (t) => position.evaluator(t),
      derivative: () => [...NAN_TRIPLE],
      speed: () => Number.NaN,
      error: "Curve derivatives could not be compiled."
    };
  }
  const [dx, dy, dz] = partials as [
    { evaluate: (scope: Record<string, number>) => number; error: string | null },
    { evaluate: (scope: Record<string, number>) => number; error: string | null },
    { evaluate: (scope: Record<string, number>) => number; error: string | null }
  ];
  // Full constant scope (S21 convention); t wins over same-named
  // parameters inside derivative expressions.
  const scopeFor = (t: number): Record<string, number> => ({
    x: 0,
    y: 0,
    z: 0,
    pi: Math.PI,
    e: Math.E,
    ...params,
    t
  });
  return {
    evaluate: (t) => position.evaluator(t),
    derivative: (t) => {
      const point: [number, number, number] = [dx.evaluate(scopeFor(t)), dy.evaluate(scopeFor(t)), dz.evaluate(scopeFor(t))];
      return finiteTriple(point) ?? [...NAN_TRIPLE];
    },
    speed: (t) => {
      const derivative: [number, number, number] = [dx.evaluate(scopeFor(t)), dy.evaluate(scopeFor(t)), dz.evaluate(scopeFor(t))];
      const finite = finiteTriple(derivative);
      if (!finite) {
        return Number.NaN;
      }
      const magnitude = Math.sqrt(finite[0] * finite[0] + finite[1] * finite[1] + finite[2] * finite[2]);
      return Number.isFinite(magnitude) ? magnitude : Number.NaN;
    },
    error: null
  };
}
