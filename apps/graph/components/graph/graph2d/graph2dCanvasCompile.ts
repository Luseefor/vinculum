import { compile } from "mathjs";
import type { CompiledMathExpression } from "./graph2dCanvasTypes";

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
    const node = compile(trimmed);
    return isCompiledMathExpression(node) ? node : null;
  } catch {
    return null;
  }
}
