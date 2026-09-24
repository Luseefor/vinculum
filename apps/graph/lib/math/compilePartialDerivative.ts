import { compile, derivative, parse, type MathNode } from "mathjs";
import { validateExpressionSafety } from "./expressionSafety";
import { formatExpressionError } from "./expressionErrorFormat";

// S21 pure symbolic first-derivative engine. Strategy (proven at the
// decision gate): mathjs `derivative()` on the parsed source node, then the
// generated expression string runs through the SAME S11 safety pipeline
// (no policy expansion — e.g. `tan(x)` differentiates to `sec(x)^2`, which
// fails as an unsupported function and becomes "derivative unavailable").
// Compiled with mathjs `compile`; evaluators never throw (NaN on
// throw/non-finite). No finite-difference fallback: unsupported means
// "unavailable", never a silent approximation.
//
// Reusable later for dense gradients, divergence, and curl without
// depending on React or Three. No `eval`/`Function` anywhere.

export interface PartialDerivativeInput {
  expression: string;
  variable: string;
  allowedSymbols?: string[];
  params: Record<string, number>;
}

export interface CompiledPartialDerivative {
  evaluate: (scope: Record<string, number>) => number;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_EVALUATOR = () => Number.NaN;
const PARTIAL_DERIVATIVE_CACHE_LIMIT = 128;
const partialDerivativeCache = new Map<string, CompiledPartialDerivative>();

function makePartialDerivativeCacheKey(expression: string, variable: string, allowedSymbols: string[]): string {
  // S20-R1 lesson: \u0000-delimited segments, never bare concatenation.
  // allowedSymbols ride along (sorted): same expression with different
  // symbol policies must not share entries. Parameter VALUES are excluded
  // (S22 PART 28): the compiled evaluator reads values from the caller
  // scope at evaluation time, so value changes never force recompilation.
  return [expression, variable, [...allowedSymbols].sort().join(",")].join("\u0000");
}

function getCachedPartialDerivative(key: string): CompiledPartialDerivative | null {
  const cached = partialDerivativeCache.get(key);
  if (!cached) return null;
  partialDerivativeCache.delete(key);
  partialDerivativeCache.set(key, cached);
  return cached;
}

function setCachedPartialDerivative(key: string, value: CompiledPartialDerivative): void {
  if (partialDerivativeCache.has(key)) {
    partialDerivativeCache.delete(key);
  }
  partialDerivativeCache.set(key, value);
  if (partialDerivativeCache.size > PARTIAL_DERIVATIVE_CACHE_LIMIT) {
    const oldestKey = partialDerivativeCache.keys().next().value;
    if (oldestKey) {
      partialDerivativeCache.delete(oldestKey);
    }
  }
}

export function compilePartialDerivative(input: PartialDerivativeInput): CompiledPartialDerivative {
  // S22 PART 28: input.params stays in the public signature (callers pass
  // their snapshot for API stability) but never enters the cache key —
  // evaluators read values from the caller scope at evaluation time.
  const { expression, variable } = input;
  const allowedSymbols = input.allowedSymbols ?? [];
  const cacheKey = makePartialDerivativeCacheKey(expression, variable, allowedSymbols);
  const cached = getCachedPartialDerivative(cacheKey);
  if (cached) {
    return cached;
  }

  const trimmed = expression.trim();
  if (!trimmed) {
    const empty: CompiledPartialDerivative = { evaluate: NAN_EVALUATOR, error: "Expression cannot be empty." };
    setCachedPartialDerivative(cacheKey, empty);
    return empty;
  }

  // Source safety first: S11 stays authoritative (nested unsafe like
  // sin(factorial(x)) fails here, before any derivative path exists).
  const sourceSafety = validateExpressionSafety(trimmed, {
    operation: "compile-partial-derivative-source",
    expressionLabel: `d/d${variable}`,
    allowedSymbols
  });
  if (!sourceSafety.ok) {
    const failed: CompiledPartialDerivative = { evaluate: NAN_EVALUATOR, error: sourceSafety.violation.message };
    setCachedPartialDerivative(cacheKey, failed);
    return failed;
  }

  let sourceNode: MathNode;
  try {
    sourceNode = parse(trimmed) as MathNode;
  } catch (error) {
    const failed: CompiledPartialDerivative = { evaluate: NAN_EVALUATOR, error: formatExpressionError(error) };
    setCachedPartialDerivative(cacheKey, failed);
    return failed;
  }

  let derivedNode: MathNode;
  try {
    derivedNode = derivative(sourceNode, parse(variable)) as MathNode;
  } catch {
    // mathjs has no rule (sign, floor, max, ...): clean "unavailable",
    // never a silent numerical fallback.
    const unavailable: CompiledPartialDerivative = {
      evaluate: NAN_EVALUATOR,
      error: "Derivative unavailable for this expression."
    };
    setCachedPartialDerivative(cacheKey, unavailable);
    return unavailable;
  }

  // Generated math is internal but still executable: re-validate through
  // the same pipeline (catches sec/csc/cot from tan, literal blowup, etc.).
  const generated = derivedNode.toString();
  const generatedSafety = validateExpressionSafety(generated, {
    operation: "compile-partial-derivative-generated",
    expressionLabel: `d/d${variable}`,
    allowedSymbols
  });
  if (!generatedSafety.ok) {
    const unavailable: CompiledPartialDerivative = {
      evaluate: NAN_EVALUATOR,
      error: `Derivative unavailable for this expression (${generatedSafety.violation.message})`
    };
    setCachedPartialDerivative(cacheKey, unavailable);
    return unavailable;
  }

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(generated) as CompiledMathExpression;
  } catch (error) {
    const failed: CompiledPartialDerivative = { evaluate: NAN_EVALUATOR, error: formatExpressionError(error) };
    setCachedPartialDerivative(cacheKey, failed);
    return failed;
  }

  const success: CompiledPartialDerivative = {
    evaluate: (scope) => {
      try {
        const value = compiledExpression.evaluate(scope);
        const numericValue = typeof value === "number" ? value : Number(value);
        return Number.isFinite(numericValue) ? numericValue : Number.NaN;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("Partial derivative evaluation failed", { error });
        }
        return Number.NaN;
      }
    },
    error: null
  };
  setCachedPartialDerivative(cacheKey, success);
  return success;
}
