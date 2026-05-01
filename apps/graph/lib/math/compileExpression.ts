import { compile } from "mathjs";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { reportWarning } from "@/lib/monitoring/errorReporting";
import type { CompiledSurfaceExpression, SurfaceEvaluator } from "./compileExpressionTypes";
import { formatExpressionError } from "./expressionErrorFormat";
import { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";
import {
  formatNonFiniteEvaluationError,
  validateExpressionSafety
} from "./expressionSafety";

export type { CompiledSurfaceExpression, SurfaceEvaluator } from "./compileExpressionTypes";
export { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: SurfaceEvaluator = () => Number.NaN;
const SURFACE_COMPILE_CACHE_LIMIT = 128;
const surfaceCompileCache = new Map<string, CompiledSurfaceExpression>();

function makeSurfaceCompileCacheKey(expression: string, orientation: "x" | "y" | "z"): string {
  return `${orientation}::${expression}`;
}

function getCachedSurfaceCompile(key: string): CompiledSurfaceExpression | null {
  const cached = surfaceCompileCache.get(key);
  if (!cached) return null;
  surfaceCompileCache.delete(key);
  surfaceCompileCache.set(key, cached);
  return cached;
}

function setCachedSurfaceCompile(key: string, value: CompiledSurfaceExpression): void {
  if (surfaceCompileCache.has(key)) {
    surfaceCompileCache.delete(key);
  }
  surfaceCompileCache.set(key, value);
  if (surfaceCompileCache.size > SURFACE_COMPILE_CACHE_LIMIT) {
    const oldestKey = surfaceCompileCache.keys().next().value;
    if (oldestKey) {
      surfaceCompileCache.delete(oldestKey);
    }
  }
}

export function compileSurfaceExpression(
  expression: string,
  orientation: "x" | "y" | "z" = "z"
): CompiledSurfaceExpression {
  const cacheKey = makeSurfaceCompileCacheKey(expression, orientation);
  const cached = getCachedSurfaceCompile(cacheKey);
  if (cached) {
    return cached;
  }
  if (!expression.trim()) {
    const emptyResult: CompiledSurfaceExpression = {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty.",
      effectiveOrientation: orientation
    };
    setCachedSurfaceCompile(cacheKey, emptyResult);
    return emptyResult;
  }

  const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(expression, orientation);
  if (!body) {
    const emptyBodyResult: CompiledSurfaceExpression = {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty.",
      effectiveOrientation
    };
    setCachedSurfaceCompile(cacheKey, emptyBodyResult);
    return emptyBodyResult;
  }

  const safety = validateExpressionSafety(body, {
    operation: "compile-surface",
    expressionLabel: "Surface equation",
    allowedSymbols: Object.keys(getEditorParameterScope()),
  });
  if (!safety.ok) {
    const safetyResult: CompiledSurfaceExpression = {
      evaluator: NAN_EVALUATOR,
      error: safety.violation.message,
      effectiveOrientation
    };
    setCachedSurfaceCompile(cacheKey, safetyResult);
    return safetyResult;
  }

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(body) as CompiledMathExpression;
  } catch (error) {
    reportWarning("Surface expression compilation failed.", {
      featureArea: "expression-eval",
      operation: "compile-surface",
      details: { expression: body.slice(0, 120), error: formatExpressionError(error) }
    });
    const compileErrorResult: CompiledSurfaceExpression = {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error),
      effectiveOrientation
    };
    setCachedSurfaceCompile(cacheKey, compileErrorResult);
    return compileErrorResult;
  }

  const getScope = (u: number, v: number) => {
    const scope: Record<string, number> = {
      x: 0,
      y: 0,
      z: 0,
      t: 0,
      pi: Math.PI,
      e: Math.E,
      ...getEditorParameterScope()
    };

    if (effectiveOrientation === "x") {
      scope.y = u;
      scope.z = v;
    } else if (effectiveOrientation === "y") {
      scope.x = u;
      scope.z = v;
    } else {
      scope.x = u;
      scope.y = v;
    }
    return scope;
  };

  try {
    const initialValue = compiledExpression.evaluate(getScope(0, 0));
    const numeric = typeof initialValue === "number" ? initialValue : Number(initialValue);
    if (!Number.isFinite(numeric)) {
      const nonFiniteResult: CompiledSurfaceExpression = {
        evaluator: NAN_EVALUATOR,
        error: formatNonFiniteEvaluationError(),
        effectiveOrientation
      };
      setCachedSurfaceCompile(cacheKey, nonFiniteResult);
      return nonFiniteResult;
    }
  } catch (error) {
    reportWarning("Surface expression validation evaluate failed.", {
      featureArea: "expression-eval",
      operation: "validate-surface",
      details: { expression: body.slice(0, 120), error: formatExpressionError(error) }
    });
    const validationErrorResult: CompiledSurfaceExpression = {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error),
      effectiveOrientation
    };
    setCachedSurfaceCompile(cacheKey, validationErrorResult);
    return validationErrorResult;
  }

  const evaluator: SurfaceEvaluator = (u, v) => {
    try {
      const result = compiledExpression.evaluate(getScope(u, v));
      const numericResult = typeof result === "number" ? result : Number(result);
      return Number.isFinite(numericResult) ? numericResult : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };

  const successResult: CompiledSurfaceExpression = {
    evaluator,
    error: null,
    effectiveOrientation
  };
  setCachedSurfaceCompile(cacheKey, successResult);
  return successResult;
}
