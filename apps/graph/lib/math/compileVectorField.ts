import { parse, type MathNode } from "mathjs";
import { compileRustExpression as compile } from "./rustMath";
import type { CompiledRustExpression, RustGridAxis } from "./rustMath";
import { validateExpressionSafety } from "./expressionSafety";
import { getParamScopeSignature } from "./paramScope";
import type { VectorFieldDimension } from "@vinculum/scene/types";

export type VectorFieldEvaluator2D = (x: number, y: number) => [number, number];
export type VectorFieldEvaluator3D = (x: number, y: number, z: number) => [number, number, number];

export interface CompiledVectorFieldExpression {
  dimension: VectorFieldDimension;
  evaluate2D: VectorFieldEvaluator2D | null;
  evaluate3D: VectorFieldEvaluator3D | null;
  error: string | null;
  evaluateGrid?: (axes: [RustGridAxis, RustGridAxis, RustGridAxis]) => Float64Array[];
}

type CompiledMathExpression = CompiledRustExpression;

const NAN_EVALUATOR_2D: VectorFieldEvaluator2D = () => [Number.NaN, Number.NaN];
const NAN_EVALUATOR_3D: VectorFieldEvaluator3D = () => [Number.NaN, Number.NaN, Number.NaN];
const MAX_ERROR_LENGTH = 92;
const VECTOR_FIELD_COMPILE_CACHE_LIMIT = 128;
const vectorFieldCompileCache = new Map<string, CompiledVectorFieldExpression>();

function makeVectorFieldCacheKey(
  dimension: VectorFieldDimension,
  pExpr: string,
  qExpr: string,
  rExpr: string,
  params: Record<string, number>
): string {
  // S20-R1: \u0000-delimited segments (mirrors compileParametricSurface).
  // Undelimited concatenation collides across expression boundaries
  // (p="ab",q="c" vs p="a",q="bc"), serving a stale wrong-field evaluator.
  return [dimension, pExpr, qExpr, rExpr, getParamScopeSignature(params)].join("\u0000");
}

function getCachedVectorFieldCompile(key: string): CompiledVectorFieldExpression | null {
  const cached = vectorFieldCompileCache.get(key);
  if (!cached) return null;
  vectorFieldCompileCache.delete(key);
  vectorFieldCompileCache.set(key, cached);
  return cached;
}

function setCachedVectorFieldCompile(key: string, value: CompiledVectorFieldExpression): void {
  if (vectorFieldCompileCache.has(key)) {
    vectorFieldCompileCache.delete(key);
  }
  vectorFieldCompileCache.set(key, value);
  if (vectorFieldCompileCache.size > VECTOR_FIELD_COMPILE_CACHE_LIMIT) {
    const oldestKey = vectorFieldCompileCache.keys().next().value;
    if (oldestKey) {
      vectorFieldCompileCache.delete(oldestKey);
    }
  }
}

export function compileVectorFieldExpressions(
  dimension: VectorFieldDimension,
  pExpr: string,
  qExpr: string,
  rExpr: string,
  params: Record<string, number>
): CompiledVectorFieldExpression {
  const cacheKey = makeVectorFieldCacheKey(dimension, pExpr, qExpr, rExpr, params);
  const cached = getCachedVectorFieldCompile(cacheKey);
  if (cached) {
    return cached;
  }

  const coordSuffix = dimension === "2d" ? "(x,y)" : "(x,y,z)";
  const axes =
    dimension === "2d"
      ? [
          { expr: pExpr, label: `P${coordSuffix}` },
          { expr: qExpr, label: `Q${coordSuffix}` }
        ]
      : [
          { expr: pExpr, label: `P${coordSuffix}` },
          { expr: qExpr, label: `Q${coordSuffix}` },
          { expr: rExpr, label: `R${coordSuffix}` }
        ];

  const compiledAxes: CompiledMathExpression[] = [];
  for (const axis of axes) {
    const compiled = compileVectorFieldAxis(axis.expr, axis.label, dimension, params);
    if (compiled.error) {
      const errorResult: CompiledVectorFieldExpression = {
        dimension,
        evaluate2D: dimension === "2d" ? NAN_EVALUATOR_2D : null,
        evaluate3D: dimension === "3d" ? NAN_EVALUATOR_3D : null,
        error: compiled.error
      };
      setCachedVectorFieldCompile(cacheKey, errorResult);
      return errorResult;
    }
    compiledAxes.push(compiled.expression as CompiledMathExpression);
  }

  let result: CompiledVectorFieldExpression;
  if (dimension === "2d") {
    const [pCompiled, qCompiled] = compiledAxes as [CompiledMathExpression, CompiledMathExpression];
    const evaluate2D: VectorFieldEvaluator2D = (x, y) => [
      evaluateVectorFieldAxis(pCompiled, { x, y }, params),
      evaluateVectorFieldAxis(qCompiled, { x, y }, params)
    ];
    result = { dimension, evaluate2D, evaluate3D: null, error: null, evaluateGrid: (axes) => compiledAxes.map((axis) => axis.evaluateGrid(axes, params)) };
  } else {
    const [pCompiled, qCompiled, rCompiled] = compiledAxes as [
      CompiledMathExpression,
      CompiledMathExpression,
      CompiledMathExpression
    ];
    const evaluate3D: VectorFieldEvaluator3D = (x, y, z) => [
      evaluateVectorFieldAxis(pCompiled, { x, y, z }, params),
      evaluateVectorFieldAxis(qCompiled, { x, y, z }, params),
      evaluateVectorFieldAxis(rCompiled, { x, y, z }, params)
    ];
    result = { dimension, evaluate2D: null, evaluate3D, error: null, evaluateGrid: (axes) => compiledAxes.map((axis) => axis.evaluateGrid(axes, params)) };
  }
  setCachedVectorFieldCompile(cacheKey, result);
  return result;
}

function compileVectorFieldAxis(
  expr: string,
  label: string,
  dimension: VectorFieldDimension,
  params: Record<string, number>
) {
  const trimmedExpr = expr.trim();
  if (!trimmedExpr) {
    return {
      expression: null,
      error: `${label} cannot be empty.`
    };
  }

  let parsedNode: MathNode;
  try {
    // S20: x/y (2D) and x/y/z (3D) are the only locals. u/v/t are reserved
    // and rejected even if an editor parameter shares the name (fail
    // closed): silently binding a parameter called "t" as field input
    // would be mathematically surprising. This mirrors the S18 reserved-t
    // traverse, extended to u/v.
    parsedNode = parse(trimmedExpr) as MathNode;
  } catch (error) {
    return {
      expression: null,
      error: `${label}: ${formatVectorFieldError(error)}`
    };
  }

  const reserved = findReservedFieldSymbol(parsedNode, dimension);
  if (reserved) {
    const locals = dimension === "2d" ? "x, y" : "x, y, z";
    return {
      expression: null,
      error: `${label}: The symbol '${reserved}' is not supported in vector fields; use ${locals}.`
    };
  }

  try {
    const safety = validateExpressionSafety(trimmedExpr, {
      operation: "compile-vector-field-axis",
      expressionLabel: label,
      allowedSymbols: [
        ...Object.keys(params),
        "x",
        "y",
        ...(dimension === "3d" ? ["z"] : [])
      ]
    });
    if (!safety.ok) {
      return {
        expression: null,
        error: `${label}: ${safety.violation.message}`
      };
    }

    return {
      expression: (compile(trimmedExpr) as CompiledMathExpression) ?? null,
      error: null
    };
  } catch (error) {
    return {
      expression: null,
      error: `${label}: ${formatVectorFieldError(error)}`
    };
  }
}

function findReservedFieldSymbol(node: MathNode, dimension: VectorFieldDimension): string | null {
  // u/v/t are never field locals; z is additionally reserved in 2D (it is
  // BASE-allowed by the safety layer, so without this check `P = z` would
  // compile and then evaluate to NaN at every sample).
  const reserved =
    dimension === "2d"
      ? new Set(["u", "v", "t", "z"])
      : new Set(["u", "v", "t"]);
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

function evaluateVectorFieldAxis(
  expression: CompiledMathExpression | null,
  locals: Record<string, number>,
  params: Record<string, number>
): number {
  if (!expression) {
    return Number.NaN;
  }

  try {
    // Locals win over same-named editor parameters (S19 convention): x/y/z
    // always mean field coordinates inside components.
    const value = expression.evaluate({ ...params, ...locals });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("Vector field axis evaluation failed", { locals, error });
    }
    return Number.NaN;
  }
}

function formatVectorFieldError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const firstLine = error.message.split("\n")[0]?.trim() ?? "Invalid expression.";
    const compact = firstLine.replace(/^Error:\s*/i, "");
    if (compact.length <= MAX_ERROR_LENGTH) {
      return compact;
    }

    return `${compact.slice(0, MAX_ERROR_LENGTH - 1)}…`;
  }

  return "Invalid expression.";
}
