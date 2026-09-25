import { compile } from "mathjs";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { getParamScopeSignature } from "./paramScope";
import { validateExpressionSafety } from "./expressionSafety";

export type ParametricEvaluator = (t: number) => [number, number, number];

export interface CompiledParametricExpression {
  evaluator: ParametricEvaluator;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: ParametricEvaluator = () => [Number.NaN, Number.NaN, Number.NaN];
const MAX_ERROR_LENGTH = 92;
const PARAMETRIC_COMPILE_CACHE_LIMIT = 128;
const parametricCompileCache = new Map<string, CompiledParametricExpression>();

function makeParametricCacheKey(xExpr: string, yExpr: string, zExpr: string): string {
  return `${xExpr}\u0000${yExpr}\u0000${zExpr}`;
}

function getCachedParametricCompile(key: string): CompiledParametricExpression | null {
  const cached = parametricCompileCache.get(key);
  if (!cached) return null;
  parametricCompileCache.delete(key);
  parametricCompileCache.set(key, cached);
  return cached;
}

function setCachedParametricCompile(key: string, value: CompiledParametricExpression): void {
  if (parametricCompileCache.has(key)) {
    parametricCompileCache.delete(key);
  }
  parametricCompileCache.set(key, value);
  if (parametricCompileCache.size > PARAMETRIC_COMPILE_CACHE_LIMIT) {
    const oldestKey = parametricCompileCache.keys().next().value;
    if (oldestKey) {
      parametricCompileCache.delete(oldestKey);
    }
  }
}

export function compileParametricExpressions(
  xExpr: string,
  yExpr: string,
  zExpr: string
): CompiledParametricExpression {
  const cacheKey = makeParametricCacheKey(xExpr, yExpr, zExpr);
  const cached = getCachedParametricCompile(cacheKey);
  if (cached) {
    return cached;
  }
  const xCompiled = compileAxisExpression(xExpr, "x(t)");
  if (xCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: xCompiled.error };
    setCachedParametricCompile(cacheKey, errorResult);
    return errorResult;
  }

  const yCompiled = compileAxisExpression(yExpr, "y(t)");
  if (yCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: yCompiled.error };
    setCachedParametricCompile(cacheKey, errorResult);
    return errorResult;
  }

  const zCompiled = compileAxisExpression(zExpr, "z(t)");
  if (zCompiled.error) {
    const errorResult = { evaluator: NAN_EVALUATOR, error: zCompiled.error };
    setCachedParametricCompile(cacheKey, errorResult);
    return errorResult;
  }

  const evaluator: ParametricEvaluator = (t) => {
    const x = evaluateAxis(xCompiled.expression, t);
    const y = evaluateAxis(yCompiled.expression, t);
    const z = evaluateAxis(zCompiled.expression, t);
    return [x, y, z];
  };

  const successResult = {
    evaluator,
    error: null
  };
  setCachedParametricCompile(cacheKey, successResult);
  return successResult;
}

function compileAxisExpression(
  expr: string,
  label: string,
  params?: Record<string, number>
) {
  const trimmedExpr = expr.trim();
  if (!trimmedExpr) {
    return {
      expression: null,
      error: `${label} cannot be empty.`
    };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    const safety = validateExpressionSafety(trimmedExpr, {
      operation: "compile-parametric-axis",
      expressionLabel: label,
      allowedSymbols: Object.keys(params ?? getEditorParameterScope())
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

  // S6: no execution probe here. Compilation answers only whether the
  // expression is syntactically valid, permitted, and compilable; per-sample
  // domain validity belongs to the runtime evaluator/sampleCurve (NaN on
  // throw or non-finite). Never probe at t=0, tMin, or any other fixed point.
  return {
    expression: compiledExpression,
    error: null
  };
}

function evaluateAxis(
  expression: CompiledMathExpression | null,
  t: number,
  params?: Record<string, number>
): number {
  if (!expression) {
    return Number.NaN;
  }

  try {
    // Locals win over same-named parameters (S19 convention): t always
    // means the curve parameter inside axis expressions.
    const value = expression.evaluate({ ...(params ?? getEditorParameterScope()), t });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("Parametric axis evaluation failed", { t, error });
    }
    return Number.NaN;
  }
}

// S25 explicit-params variant for worker-safe integral geometry. Same
// axis validation and evaluator semantics as the legacy entry, but the
// parameter snapshot travels explicitly (S19 rule) and the cache key
// carries the snapshot signature (the legacy key omits params and is left
// untouched for existing callers).
export function compileParametricCurveExpressions(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  params: Record<string, number>
): CompiledParametricExpression {
  // S20-R1: \u0000-delimited segments, never bare concatenation (expression
  // boundaries must not collide across axes).
  const cacheKey = [xExpr, yExpr, zExpr, getParamScopeSignature(params)].join("\u0000");
  const cached = getCachedParametricCompile(cacheKey);
  if (cached) {
    return cached;
  }
  const axes: Array<[string, string]> = [
    [xExpr, "x(t)"],
    [yExpr, "y(t)"],
    [zExpr, "z(t)"]
  ];
  const compiledAxes: CompiledMathExpression[] = [];
  for (const [expr, label] of axes) {
    const compiled = compileAxisExpression(expr, label, params);
    if (compiled.error) {
      const errorResult = { evaluator: NAN_EVALUATOR, error: compiled.error };
      setCachedParametricCompile(cacheKey, errorResult);
      return errorResult;
    }
    compiledAxes.push(compiled.expression as CompiledMathExpression);
  }
  const [xCompiled, yCompiled, zCompiled] = compiledAxes as [
    CompiledMathExpression,
    CompiledMathExpression,
    CompiledMathExpression
  ];
  const evaluator: ParametricEvaluator = (t) => [
    evaluateAxis(xCompiled, t, params),
    evaluateAxis(yCompiled, t, params),
    evaluateAxis(zCompiled, t, params)
  ];
  const successResult = { evaluator, error: null };
  setCachedParametricCompile(cacheKey, successResult);
  return successResult;
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
