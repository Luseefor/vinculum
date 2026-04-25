import { compile } from "mathjs";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

export type SurfaceEvaluator = (u: number, v: number) => number;

export interface CompiledSurfaceExpression {
  evaluator: SurfaceEvaluator;
  error: string | null;
  /** Orientation used for f(u,v) sampling (equation wins over UI when the equation starts with x=, y=, or z=). */
  effectiveOrientation: "x" | "y" | "z";
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: SurfaceEvaluator = () => Number.NaN;
const MAX_ERROR_LENGTH = 92;

const EXPLICIT_AXIS = /^([xyz])\s*=\s*(.+)$/i;
const IMPLICIT_STRIP = /^[a-z](\([a-z,\s]*\))?\s*=\s*/i;

/**
 * If the leading form is a simple axis assignment (`x=…`, `y=…`, `z=…`), that axis
 * is the dependent variable (independent of the surface orientation UI).
 * Otherwise uses the same implicit strip as before and the UI `fallbackOrientation`.
 */
export function getEffectiveSurfaceOrientation(
  expression: string,
  fallbackOrientation: "x" | "y" | "z" = "z"
): { body: string; effectiveOrientation: "x" | "y" | "z" } {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { body: "", effectiveOrientation: fallbackOrientation };
  }

  const explicit = EXPLICIT_AXIS.exec(trimmed);
  if (explicit) {
    const letter = explicit[1].toLowerCase();
    if (letter === "x" || letter === "y" || letter === "z") {
      return {
        body: explicit[2].trim(),
        effectiveOrientation: letter
      };
    }
  }

  return {
    body: trimmed.replace(IMPLICIT_STRIP, "").trim(),
    effectiveOrientation: fallbackOrientation
  };
}

export function compileSurfaceExpression(expression: string, orientation: "x" | "y" | "z" = "z"): CompiledSurfaceExpression {
  if (!expression.trim()) {
    return {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty.",
      effectiveOrientation: orientation
    };
  }

  const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(expression, orientation);
  if (!body) {
    return {
      evaluator: NAN_EVALUATOR,
      error: "Equation cannot be empty.",
      effectiveOrientation
    };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(body) as CompiledMathExpression;
  } catch (error) {
    return {
      evaluator: NAN_EVALUATOR,
      error: formatExpressionError(error),
      effectiveOrientation
    };
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
      // x = f(y, z) -> u=y, v=z
      scope.y = u;
      scope.z = v;
    } else if (effectiveOrientation === "y") {
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
      error: formatExpressionError(error),
      effectiveOrientation
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
    error: null,
    effectiveOrientation
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
