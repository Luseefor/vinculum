import { compile } from "mathjs";

export type SurfaceEvaluator = (u: number, v: number) => number;

export interface CompiledSurfaceExpression {
  evaluator: SurfaceEvaluator;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: SurfaceEvaluator = () => Number.NaN;
const MAX_ERROR_LENGTH = 92;

export function compileSurfaceExpression(expression: string, orientation: "x" | "y" | "z" = "z"): CompiledSurfaceExpression {
  let trimmedExpression = expression.trim();
  if (!trimmedExpression) {
    return {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty."
    };
  }

  // Strip prefixes like "z =", "y =", "x =", "f(x,y) =", etc.
  trimmedExpression = trimmedExpression.replace(/^[a-z](\([a-z,\s]*\))?\s*=\s*/i, "");

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(trimmedExpression) as CompiledMathExpression;
  } catch (error) {
    return {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error)
    };
  }

  const getScope = (u: number, v: number) => {
    const scope: Record<string, number> = {
      x: 0,
      y: 0,
      z: 0,
      t: 0,
      pi: Math.PI,
      e: Math.E
    };

    if (orientation === "x") {
      // x = f(y, z) -> u=y, v=z
      scope.y = u;
      scope.z = v;
    } else if (orientation === "y") {
      // y = f(x, z) -> u=x, v=z
      scope.x = u;
      scope.z = v;
    } else {
      // z = f(x, y) -> u=x, v=y
      scope.x = u;
      scope.y = v;
    }
    return scope;
  };

  try {
    // Probe once to surface undefined symbol/function errors directly in row UI.
    compiledExpression.evaluate(getScope(0, 0));
  } catch (error) {
    return {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error)
    };
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
