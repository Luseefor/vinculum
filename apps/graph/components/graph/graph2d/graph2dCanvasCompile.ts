import { compile } from "mathjs";
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
    // Quick sanity evaluation to prevent non-finite values from silently propagating.
    const scope: Record<string, number> = { x: 0, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E };
    const initial = node.evaluate(scope);
    const numeric = typeof initial === "number" ? initial : Number(initial);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return isCompiledMathExpression(node) ? node : null;
  } catch {
    return null;
  }
}
