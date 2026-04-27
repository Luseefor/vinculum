import { compile } from "mathjs";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import type { CompiledSurfaceExpression, SurfaceEvaluator } from "./compileExpressionTypes";
import { formatExpressionError } from "./expressionErrorFormat";
import { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";

export type { CompiledSurfaceExpression, SurfaceEvaluator } from "./compileExpressionTypes";
export { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR: SurfaceEvaluator = () => Number.NaN;

export function compileSurfaceExpression(
  expression: string,
  orientation: "x" | "y" | "z" = "z"
): CompiledSurfaceExpression {
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
