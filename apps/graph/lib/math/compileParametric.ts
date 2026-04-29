import { compile } from "mathjs";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { formatNonFiniteEvaluationError, validateExpressionSafety } from "./expressionSafety";

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

function compileAxisExpression(expr: string, label: string) {
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
      allowedSymbols: Object.keys(getEditorParameterScope())
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

  try {
    const initialValue = compiledExpression.evaluate({ t: 0, ...getEditorParameterScope() });
    const numeric = typeof initialValue === "number" ? initialValue : Number(initialValue);
    if (!Number.isFinite(numeric)) {
      return {
        expression: null,
        error: `${label}: ${formatNonFiniteEvaluationError()}`
      };
    }
  } catch (error) {
    return {
      expression: null,
      error: `${label}: ${formatExpressionError(error)}`
    };
  }

  return {
    expression: compiledExpression,
    error: null
  };
}

function evaluateAxis(expression: CompiledMathExpression | null, t: number): number {
  if (!expression) {
    return Number.NaN;
  }

  try {
    const value = expression.evaluate({ t, ...getEditorParameterScope() });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("Parametric axis evaluation failed", { t, error });
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
