import { compile } from "mathjs";
import { validateExpressionSafety } from "./expressionSafety";
import { getParamScopeSignature } from "./paramScope";

export type ParametricSurfaceEvaluator = (u: number, v: number) => [number, number, number];

export interface CompiledParametricSurfaceExpression {
  evaluator: ParametricSurfaceEvaluator;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: ParametricSurfaceEvaluator = () => [Number.NaN, Number.NaN, Number.NaN];
const MAX_ERROR_LENGTH = 92;
const PARAMETRIC_SURFACE_COMPILE_CACHE_LIMIT = 128;
const parametricSurfaceCompileCache = new Map<string, CompiledParametricSurfaceExpression>();

function makeParametricSurfaceCacheKey(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  params: Record<string, number>
): string {
  return `${xExpr}\u0000${yExpr}\u0000${zExpr}\u0000${getParamScopeSignature(params)}`;
}

function getCachedParametricSurfaceCompile(key: string): CompiledParametricSurfaceExpression | null {
  const cached = parametricSurfaceCompileCache.get(key);
  if (!cached) return null;
  parametricSurfaceCompileCache.delete(key);
  parametricSurfaceCompileCache.set(key, cached);
  return cached;
}

function setCachedParametricSurfaceCompile(key: string, value: CompiledParametricSurfaceExpression): void {
  if (parametricSurfaceCompileCache.has(key)) {
    parametricSurfaceCompileCache.delete(key);
  }
  parametricSurfaceCompileCache.set(key, value);
  if (parametricSurfaceCompileCache.size > PARAMETRIC_SURFACE_COMPILE_CACHE_LIMIT) {
    const oldestKey = parametricSurfaceCompileCache.keys().next().value;
    if (oldestKey) {
      parametricSurfaceCompileCache.delete(oldestKey);
    }
  }
}

export function compileParametricSurfaceExpressions(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  params: Record<string, number>
): CompiledParametricSurfaceExpression {
  const cacheKey = makeParametricSurfaceCacheKey(xExpr, yExpr, zExpr, params);
  const cached = getCachedParametricSurfaceCompile(cacheKey);
  if (cached) {
    return cached;
  }
  const xCompiled = compileSurfaceAxisExpression(xExpr, "x(u,v)", params);
  if (xCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: xCompiled.error };
    setCachedParametricSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  const yCompiled = compileSurfaceAxisExpression(yExpr, "y(u,v)", params);
  if (yCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: yCompiled.error };
    setCachedParametricSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  const zCompiled = compileSurfaceAxisExpression(zExpr, "z(u,v)", params);
  if (zCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: zCompiled.error };
    setCachedParametricSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  const evaluator: ParametricSurfaceEvaluator = (u, v) => {
    const x = evaluateSurfaceAxis(xCompiled.expression, u, v, params);
    const y = evaluateSurfaceAxis(yCompiled.expression, u, v, params);
    const z = evaluateSurfaceAxis(zCompiled.expression, u, v, params);
    return [x, y, z];
  };

  const successResult = {
    evaluator,
    error: null
  };
  setCachedParametricSurfaceCompile(cacheKey, successResult);
  return successResult;
}

function compileSurfaceAxisExpression(expr: string, label: string, params: Record<string, number>) {
  const trimmedExpr = expr.trim();
  if (!trimmedExpr) {
    return {
      expression: null,
      error: `${label} cannot be empty.`
    };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    // S17: u/v are reserved locals for parametric surfaces. They ride the
    // per-call allowedSymbols (BASE x/y/z/t/pi/e unchanged, so no policy
    // change for other compilers). Editor parameters stay available (S19:
    // from the explicit snapshot); pi/e resolve as mathjs built-in constants.
    const safety = validateExpressionSafety(trimmedExpr, {
      operation: "compile-parametric-surface-axis",
      expressionLabel: label,
      allowedSymbols: [...Object.keys(params), "u", "v"]
    });
    if (!safety.ok) {
      return {
        expression: null,
        error: `${label}: ${safety.violation.message}`
      };
    }

    compiledExpression = compile(trimmedExpr) as CompiledMathExpression;
  } catch (error) {
    return {
      expression: null,
      error: `${label}: ${formatExpressionError(error)}`
    };
  }

  // S9/S6: no execution probe here. Compilation answers only whether the
  // expression is syntactically valid, permitted, and compilable; per-sample
  // domain validity belongs to the runtime evaluator/sampleParametricSurface
  // (NaN on throw or non-finite). Never probe at a fixed (u, v) point, so
  // expressions like x = 1/u stay compilable over domains containing u = 0.
  return {
    expression: compiledExpression,
    error: null
  };
}

function evaluateSurfaceAxis(
  expression: CompiledMathExpression | null,
  u: number,
  v: number,
  params: Record<string, number>
): number {
  if (!expression) {
    return Number.NaN;
  }

  try {
    // Locals win over same-named editor parameters: u/v always mean the
    // surface parameters inside these expressions.
    const value = expression.evaluate({ ...params, u, v });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("Parametric surface axis evaluation failed", { u, v, error });
    }
    return Number.NaN;
  }
}

function formatExpressionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const firstLine = error.message.split("\n")[0]?.trim() ?? "Invalid expression.";
    const compact = firstLine.replace(/^Error:\s*/i, "");
    if (compact.length <= MAX_ERROR_LENGTH) {
      return compact;
    }

    return `${compact.slice(0, MAX_ERROR_LENGTH - 1)}…`;
  }

  return "Invalid expression.";
}
