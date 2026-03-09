import { compile } from "mathjs";

export type SurfaceEvaluator = (x: number, y: number) => number;

export interface CompiledSurfaceExpression {
  evaluator: SurfaceEvaluator;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: SurfaceEvaluator = () => Number.NaN;
const MAX_ERROR_LENGTH = 92;

export function compileSurfaceExpression(expression: string): CompiledSurfaceExpression {
  const trimmedExpression = expression.trim();
  if (!trimmedExpression) {
    return {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty."
    };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(trimmedExpression) as CompiledMathExpression;
  } catch (error) {
    return {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error)
    };
  }

  try {
    // Probe once to surface undefined symbol/function errors directly in row UI.
    compiledExpression.evaluate({ x: 0, y: 0 });
  } catch (error) {
    return {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error)
    };
  }

  const evaluator: SurfaceEvaluator = (x, y) => {
    try {
      const result = compiledExpression.evaluate({ x, y });
      const numericResult = typeof result === "number" ? result : Number(result);
      return Number.isFinite(numericResult) ? numericResult : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };

  return {
    evaluator,
    error: null
  };
}

function formatExpressionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const firstLine = error.message.split("\n")[0]?.trim() ?? "Invalid expression.";
    return truncate(firstLine.replace(/^Error:\s*/i, ""));
  }

  return "Invalid expression.";
}

function truncate(value: string): string {
  if (value.length <= MAX_ERROR_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_ERROR_LENGTH - 1)}…`;
}
