import { compileRustExpression as compile } from "@/lib/math/rustMath";
import type { CompiledMathExpression } from "./graph2dCanvasTypes";
import { validateExpressionSafety } from "@/lib/math/expressionSafety";

function isCompiledMathExpression(value: unknown): value is CompiledMathExpression {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "evaluate" in value && typeof (value as { evaluate?: unknown }).evaluate === "function";
}

export function tryCompileMathExpression(expr: string): CompiledMathExpression | null {
  const trimmed = expr.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const safety = validateExpressionSafety(trimmed, {
      operation: "compile-2d",
      expressionLabel: "2D graph expression"
    });
    if (!safety.ok) {
      return null;
    }

    const node = compile(trimmed);
    // S9 (F1): smoke-evaluate once to catch expressions that cannot
    // evaluate at all (unknown symbols, arity errors) — those still fail.
    // A non-finite mathematical result at this arbitrary point is a
    // sampling-domain concern handled per point by the evaluate closures,
    // which return null on throw or non-finite.
    const scope: Record<string, number> = { x: 0, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E };
    try {
      node.evaluate(scope);
    } catch {
      return null;
    }
    return isCompiledMathExpression(node) ? node : null;
  } catch {
    return null;
  }
}
