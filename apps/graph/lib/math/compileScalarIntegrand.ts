import { parse, type MathNode } from "mathjs";
import { compileRustExpression as compile } from "./rustMath";
import { getParamScopeSignature } from "./paramScope";
import { validateExpressionSafety } from "./expressionSafety";

// S25 single safe scalar-integrand compiler for g(x,y,z) used by scalar
// line and scalar surface integrals. Bare scalar expressions only: x/y/z
// plus canonical parameter keys. No `=`, no assignments, and no t/u/v
// (the integrand is evaluated in physical mathematical coordinates; the
// parameter variables belong to the geometry being integrated over, never
// to g itself). S11 is reused verbatim — no separate safety policy, no
// eval, no Function constructor. Worker-safe: explicit params, no store.

export type ScalarIntegrandEvaluator = (x: number, y: number, z: number) => number;

export interface CompiledScalarIntegrand {
  evaluator: ScalarIntegrandEvaluator;
  error: string | null;
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

const NAN_INTEGRAND: ScalarIntegrandEvaluator = () => Number.NaN;
const INTEGRAND_COMPILE_CACHE_LIMIT = 128;
const integrandCompileCache = new Map<string, CompiledScalarIntegrand>();

function makeIntegrandCacheKey(expression: string, params: Record<string, number>): string {
  return [expression, getParamScopeSignature(params)].join("\u0000");
}

function getCachedIntegrand(key: string): CompiledScalarIntegrand | null {
  const cached = integrandCompileCache.get(key);
  if (!cached) return null;
  integrandCompileCache.delete(key);
  integrandCompileCache.set(key, cached);
  return cached;
}

function setCachedIntegrand(key: string, value: CompiledScalarIntegrand): void {
  if (integrandCompileCache.has(key)) {
    integrandCompileCache.delete(key);
  }
  integrandCompileCache.set(key, value);
  if (integrandCompileCache.size > INTEGRAND_COMPILE_CACHE_LIMIT) {
    const oldestKey = integrandCompileCache.keys().next().value;
    if (oldestKey) {
      integrandCompileCache.delete(oldestKey);
    }
  }
}

export function compileScalarIntegrand(
  expression: string,
  params: Record<string, number>
): CompiledScalarIntegrand {
  const cacheKey = makeIntegrandCacheKey(expression, params);
  const cached = getCachedIntegrand(cacheKey);
  if (cached) {
    return cached;
  }
  const trimmed = expression.trim();
  if (!trimmed) {
    const empty: CompiledScalarIntegrand = { evaluator: NAN_INTEGRAND, error: "Integrand cannot be empty." };
    setCachedIntegrand(cacheKey, empty);
    return empty;
  }
  if (trimmed.includes("=")) {
    const rejected: CompiledScalarIntegrand = {
      evaluator: NAN_INTEGRAND,
      error: "Integrand must be a bare expression in x, y, z (no '=')."
    };
    setCachedIntegrand(cacheKey, rejected);
    return rejected;
  }
  // t/u/v are parameter variables of the geometry being integrated over,
  // never integrand locals (PART 4). t is BASE-allowed by the safety
  // layer, so it needs this explicit object-specific rejection — the same
  // fail-closed traverse the vector-field compiler uses.
  try {
    const reserved = findReservedIntegrandSymbol(parse(trimmed) as MathNode);
    if (reserved) {
      const rejected: CompiledScalarIntegrand = {
        evaluator: NAN_INTEGRAND,
        error: `The symbol '${reserved}' is not supported in scalar integrands; use x, y, z.`
      };
      setCachedIntegrand(cacheKey, rejected);
      return rejected;
    }
  } catch {
    const failed: CompiledScalarIntegrand = { evaluator: NAN_INTEGRAND, error: "Invalid expression syntax." };
    setCachedIntegrand(cacheKey, failed);
    return failed;
  }
  const safety = validateExpressionSafety(trimmed, {
    operation: "compile-scalar-integrand",
    expressionLabel: "Scalar integrand",
    allowedSymbols: [...Object.keys(params), "x", "y", "z"]
  });
  if (!safety.ok) {
    const failed: CompiledScalarIntegrand = { evaluator: NAN_INTEGRAND, error: safety.violation.message };
    setCachedIntegrand(cacheKey, failed);
    return failed;
  }
  let compiled: CompiledMathExpression;
  try {
    compiled = compile(trimmed) as CompiledMathExpression;
  } catch {
    const failed: CompiledScalarIntegrand = { evaluator: NAN_INTEGRAND, error: "Integrand could not be compiled." };
    setCachedIntegrand(cacheKey, failed);
    return failed;
  }
  const evaluator: ScalarIntegrandEvaluator = (x, y, z) => {
    try {
      // Physical coordinates win over same-named parameters (S19 rule).
      const value = compiled.evaluate({ ...params, x, y, z });
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
  const success: CompiledScalarIntegrand = { evaluator, error: null };
  setCachedIntegrand(cacheKey, success);
  return success;
}

function findReservedIntegrandSymbol(node: MathNode): string | null {
  const reserved = new Set(["t", "u", "v"]);
  let found: string | null = null;
  node.traverse((childNode: MathNode, path: string) => {
    if (found || path === "fn") {
      return;
    }
    const maybeSymbol = childNode as unknown as { type?: string; isSymbolNode?: boolean; name?: unknown };
    const isSymbolNode = maybeSymbol.type === "SymbolNode" || Boolean(maybeSymbol.isSymbolNode);
    if (isSymbolNode && typeof maybeSymbol.name === "string" && reserved.has(maybeSymbol.name)) {
      found = maybeSymbol.name;
    }
  });
  return found;
}
