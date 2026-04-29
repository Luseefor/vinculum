import { compile } from "mathjs";
import { reportWarning } from "@/lib/monitoring/errorReporting";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const expressionCache = new Map<string, CompiledMathExpression>();

export function evaluateExpression(expression: string, scope: Record<string, number>): number | null {
  const trimmed = expression.trim();
  if (!trimmed) {
    return null;
  }

  let compiled = expressionCache.get(trimmed);
  if (!compiled) {
    try {
      const next = compile(trimmed);
      if (!isCompiledMathExpression(next)) {
        return null;
      }
      compiled = next;
      expressionCache.set(trimmed, next);
    } catch {
      reportWarning("Expression compilation failed during evaluation.", {
        featureArea: "expression-eval",
        operation: "compile",
        details: { expression: trimmed.slice(0, 120) }
      });
      return null;
    }
  }

  try {
    const result = compiled.evaluate(scope);
    const numeric = typeof result === "number" ? result : Number(result);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    reportWarning("Expression evaluation failed.", {
      featureArea: "expression-eval",
      operation: "evaluate",
      details: { expression: trimmed.slice(0, 120) }
    });
    return null;
  }
}

export function clearExpressionCache() {
  expressionCache.clear();
}

function isCompiledMathExpression(value: unknown): value is CompiledMathExpression {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "evaluate" in value && typeof (value as { evaluate?: unknown }).evaluate === "function";
}
