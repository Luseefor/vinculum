import { compile } from "mathjs";

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

export function compileParametricExpressions(
  xExpr: string,
  yExpr: string,
  zExpr: string
): CompiledParametricExpression {
  const xCompiled = compileAxisExpression(xExpr, "x(t)");
  if (xCompiled.error) {
    return { evaluator: NAN_EVALUATOR, error: xCompiled.error };
  }

  const yCompiled = compileAxisExpression(yExpr, "y(t)");
  if (yCompiled.error) {
    return { evaluator: NAN_EVALUATOR, error: yCompiled.error };
  }

  const zCompiled = compileAxisExpression(zExpr, "z(t)");
  if (zCompiled.error) {
    return { evaluator: NAN_EVALUATOR, error: zCompiled.error };
  }

  const evaluator: ParametricEvaluator = (t) => {
    const x = evaluateAxis(xCompiled.expression, t);
    const y = evaluateAxis(yCompiled.expression, t);
    const z = evaluateAxis(zCompiled.expression, t);
    return [x, y, z];
  };

  return {
    evaluator,
    error: null
  };
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
    compiledExpression = compile(trimmedExpr) as CompiledMathExpression;
  } catch (error) {
    return {
      expression: null,
      error: `${label}: ${formatExpressionError(error)}`
    };
  }

  try {
    compiledExpression.evaluate({ t: 0 });
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
    const value = expression.evaluate({ t });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch {
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
