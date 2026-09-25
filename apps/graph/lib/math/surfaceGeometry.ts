import { compileParametricSurfaceExpressions } from "./compileParametricSurface";
import { compilePartialDerivative } from "./compilePartialDerivative";
import { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";
import { validateExpressionSafety } from "./expressionSafety";
import { compile } from "mathjs";

// S25 surface differential geometry for explicit and parametric
// surfaces. All first derivatives come from the S21 symbolic core — no
// finite differences, ever. Worker-safe: explicit params, no store.
//
// Explicit orientation convention (matches S21 level sets exactly):
//   z = f(x,y): independent (x, y), directed area <-fx,-fy,1>  (+z)
//   x = f(y,z): independent (y, z), directed area <1,-fy,-fz>  (+x)
//   y = f(x,z): independent (x, z), directed area <-fx,1,-fz>  (+y)
// Parametric native orientation: Pu × Pv from canonical (u, v) order.
// Reverse orientation multiplies the directed area vector by -1 (flux
// sign flips; area and scalar integrals are invariant).
//
// Degenerate points (Pu × Pv = 0, e.g. sphere poles) contribute 0 area —
// valid, never NaN. Non-finite derivatives fail the evaluation closed.

export type SurfaceOrientation = "x" | "y" | "z";

export interface CompiledSurfaceGeometry {
  /** Independent variable names in (u, v) order. */
  vars: [string, string];
  /** Position P(u, v) as [x, y, z]; NaN triple when unavailable. */
  evaluate: (u: number, v: number) => [number, number, number];
  /** Directed area vector (orientation applied); NaN triple when unavailable. */
  areaVector: (u: number, v: number) => [number, number, number];
  /** Area factor ||directed|| (0 at degenerate points, NaN when unavailable). */
  areaFactor: (u: number, v: number) => number;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_TRIPLE: [number, number, number] = [Number.NaN, Number.NaN, Number.NaN];

function scopeFor(params: Record<string, number>, assignments: Record<string, number>): Record<string, number> {
  return { x: 0, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E, ...params, ...assignments };
}

function finiteTriple(value: [number, number, number]): [number, number, number] | null {
  if (value.some((component) => !Number.isFinite(component))) {
    return null;
  }
  return value;
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function compileBodyExpression(
  body: string,
  label: string,
  params: Record<string, number>
): { expression: CompiledMathExpression | null; error: string | null } {
  const safety = validateExpressionSafety(body, {
    operation: "compile-surface-geometry",
    expressionLabel: label,
    allowedSymbols: Object.keys(params)
  });
  if (!safety.ok) {
    return { expression: null, error: safety.violation.message };
  }
  try {
    return { expression: compile(body) as CompiledMathExpression, error: null };
  } catch {
    return { expression: null, error: "Surface expression could not be compiled." };
  }
}

export function compileExplicitSurfaceGeometry(
  equation: string,
  orientation: SurfaceOrientation,
  params: Record<string, number>
): CompiledSurfaceGeometry {
  const unsupported = (error: string): CompiledSurfaceGeometry => ({
    vars: ["x", "y"],
    evaluate: () => [...NAN_TRIPLE],
    areaVector: () => [...NAN_TRIPLE],
    areaFactor: () => Number.NaN,
    error
  });
  const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(equation, orientation);
  if (!body) {
    return unsupported("Equation cannot be empty.");
  }
  const compiled = compileBodyExpression(body, "Surface", params);
  if (!compiled.expression || compiled.error) {
    return unsupported(compiled.error ?? "Surface expression could not be compiled.");
  }
  const bodyExpression = compiled.expression;
  const allowedSymbols = Object.keys(params);
  const vars: [string, string] =
    effectiveOrientation === "x" ? ["y", "z"] : effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
  const du = compilePartialDerivative({ expression: body, variable: vars[0], allowedSymbols, params });
  if (du.error) {
    return unsupported(du.error);
  }
  const dv = compilePartialDerivative({ expression: body, variable: vars[1], allowedSymbols, params });
  if (dv.error) {
    return unsupported(dv.error);
  }
  const evaluateBody = (u: number, v: number): number => {
    try {
      const value = bodyExpression.evaluate(scopeFor(params, { [vars[0]]: u, [vars[1]]: v }));
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
  // Directed area from the S21 level-set gradient (positive dependent
  // axis): G = dep − f gives <-fx,-fy,1> etc. exactly.
  const directed = (u: number, v: number): [number, number, number] | null => {
    const f = evaluateBody(u, v);
    if (!Number.isFinite(f)) {
      return null;
    }
    const scope = scopeFor(params, { [vars[0]]: u, [vars[1]]: v });
    const fu = du.evaluate(scope);
    const fv = dv.evaluate(scope);
    if (!Number.isFinite(fu) || !Number.isFinite(fv)) {
      return null;
    }
    if (effectiveOrientation === "x") {
      return [1, -fu, -fv];
    }
    if (effectiveOrientation === "y") {
      return [-fu, 1, -fv];
    }
    return [-fu, -fv, 1];
  };
  return {
    vars,
    evaluate: (u, v) => {
      const f = evaluateBody(u, v);
      if (!Number.isFinite(f)) {
        return [...NAN_TRIPLE];
      }
      // Math coordinates (never world): dependent axis carries f.
      if (effectiveOrientation === "x") {
        return [f, u, v];
      }
      if (effectiveOrientation === "y") {
        return [u, f, v];
      }
      return [u, v, f];
    },
    areaVector: (u, v) => directed(u, v) ?? [...NAN_TRIPLE],
    areaFactor: (u, v) => {
      const vector = directed(u, v);
      if (!vector) {
        return Number.NaN;
      }
      const magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
      return Number.isFinite(magnitude) ? magnitude : Number.NaN;
    },
    error: null
  };
}

export function compileParametricSurfaceGeometry(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  params: Record<string, number>
): CompiledSurfaceGeometry {
  const unsupported = (error: string): CompiledSurfaceGeometry => ({
    vars: ["u", "v"],
    evaluate: () => [...NAN_TRIPLE],
    areaVector: () => [...NAN_TRIPLE],
    areaFactor: () => Number.NaN,
    error
  });
  const position = compileParametricSurfaceExpressions(xExpr, yExpr, zExpr, params);
  if (position.error) {
    return unsupported(position.error);
  }
  const allowedSymbols = [...Object.keys(params), "u", "v"];
  const partials = (
    [
      [xExpr, "x"],
      [yExpr, "y"],
      [zExpr, "z"]
    ] as Array<[string, string]>
  ).map(([expr]) => ({
    u: compilePartialDerivative({ expression: expr, variable: "u", allowedSymbols, params }),
    v: compilePartialDerivative({ expression: expr, variable: "v", allowedSymbols, params })
  }));
  const failed = partials.flatMap((pair) => [pair.u, pair.v]).find((partial) => partial.error !== null);
  if (failed?.error) {
    // S21/S22 unsupported-derivative policy: the surface stays
    // valid/renderable; analysis reports unavailable (PART 30).
    return unsupported(failed.error);
  }
  const at = (u: number, v: number) => scopeFor(params, { u, v });
  const tangent = (
    u: number,
    v: number,
    which: "u" | "v"
  ): [number, number, number] | null => {
    const point: [number, number, number] = [
      partials[0]?.[which].evaluate(at(u, v)) as number,
      partials[1]?.[which].evaluate(at(u, v)) as number,
      partials[2]?.[which].evaluate(at(u, v)) as number
    ];
    return finiteTriple(point);
  };
  return {
    vars: ["u", "v"],
    evaluate: (u, v) => {
      try {
        const point = position.evaluator(u, v);
        return finiteTriple(point) ?? [...NAN_TRIPLE];
      } catch {
        return [...NAN_TRIPLE];
      }
    },
    areaVector: (u, v) => {
      const pu = tangent(u, v, "u");
      const pv = tangent(u, v, "v");
      if (!pu || !pv) {
        return [...NAN_TRIPLE];
      }
      // Native orientation: Pu × Pv from canonical (u, v) order.
      return cross(pu, pv);
    },
    areaFactor: (u, v) => {
      const pu = tangent(u, v, "u");
      const pv = tangent(u, v, "v");
      if (!pu || !pv) {
        return Number.NaN;
      }
      const normal = cross(pu, pv);
      const magnitude = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      // Degenerate points (poles) contribute 0 area — valid, never NaN
      // unless the derivatives themselves failed (handled above).
      return Number.isFinite(magnitude) ? magnitude : Number.NaN;
    },
    error: null
  };
}
