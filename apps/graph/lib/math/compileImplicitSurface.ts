import { compileRustExpression, type CompiledRustExpression } from "./rustMath";
import { MAX_IMPLICIT_SURFACE_RESOLUTION } from "@vinculum/scene/defaults";
import type { ImplicitSurfaceDomain } from "@vinculum/scene/types";
import { parse } from "mathjs";
import type { MathNode } from "mathjs";
import { validateExpressionSafety } from "./expressionSafety";
import { splitSingleMathEquality } from "./implicitEquation";
import { getParamScopeSignature } from "./paramScope";

export type ImplicitSurfaceEvaluator = ((x: number, y: number, z: number) => number) & {
  sampleGrid?: (domain: ImplicitSurfaceDomain, resolution: number) => Float64Array;
};

export interface CompiledImplicitSurfaceExpression {
  evaluator: ImplicitSurfaceEvaluator;
  error: string | null;
  samplePlaneGrid?: (horizontal: "x" | "y" | "z", vertical: "x" | "y" | "z", hMin: number, hMax: number, columns: number, vMin: number, vMax: number, rows: number) => Float64Array;
  sampleXYGrid?: (xMin: number, xMax: number, columns: number, yMin: number, yMax: number, rows: number) => Float64Array;
}

type CompiledMathExpression = CompiledRustExpression;

const MAX_ERROR_LENGTH = 92;
const IMPLICIT_SURFACE_COMPILE_CACHE_LIMIT = 128;
const implicitSurfaceCompileCache = new Map<string, CompiledImplicitSurfaceExpression>();

function getCachedImplicitSurfaceCompile(key: string): CompiledImplicitSurfaceExpression | null {
  const cached = implicitSurfaceCompileCache.get(key);
  if (!cached) return null;
  implicitSurfaceCompileCache.delete(key);
  implicitSurfaceCompileCache.set(key, cached);
  return cached;
}

function setCachedImplicitSurfaceCompile(key: string, value: CompiledImplicitSurfaceExpression): void {
  if (implicitSurfaceCompileCache.has(key)) {
    implicitSurfaceCompileCache.delete(key);
  }
  implicitSurfaceCompileCache.set(key, value);
  if (implicitSurfaceCompileCache.size > IMPLICIT_SURFACE_COMPILE_CACHE_LIMIT) {
    const oldestKey = implicitSurfaceCompileCache.keys().next().value;
    if (oldestKey) {
      implicitSurfaceCompileCache.delete(oldestKey);
    }
  }
}

export function compileImplicitSurfaceExpression(
  equation: string,
  params: Record<string, number>
): CompiledImplicitSurfaceExpression {
  const rawEquation = equation.trim();
  // S19: the cache key includes the parameter snapshot signature. A cached
  // evaluator closes over the params it was compiled with, so same-equation
  // different-params requests must not share entries (this also fixes the
  // pre-S19 staleness where param add/remove reused cached evaluators).
  const cacheKey = `${rawEquation}::${getParamScopeSignature(params)}`;
  const cached = getCachedImplicitSurfaceCompile(cacheKey);
  if (cached) {
    return cached;
  }

  if (!rawEquation) {
    const errorResult = {
      evaluator: () => Number.NaN,
      error: "Equation cannot be empty."
    };
    setCachedImplicitSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  // Mathematical equality `lhs = rhs` normalizes to `lhs - rhs` for
  // evaluation only. The raw string is never rewritten in scene storage.
  // Splitting happens BEFORE mathjs parsing so `=` can never become an
  // AssignmentNode; `==`, chained `=`, and missing sides are rejected
  // outright (a bare field never contains `=`, so any surviving `=` after
  // a failed split is malformed input, never a mathjs comparison).
  const equality = splitSingleMathEquality(rawEquation);
  if (!equality && rawEquation.includes("=")) {
    const errorResult = {
      evaluator: () => Number.NaN,
      error: "Equation must contain exactly one '=' with expressions on both sides."
    };
    setCachedImplicitSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }
  const lhsSource = equality ? equality.lhs : rawEquation;
  const rhsSource = equality ? equality.rhs : "0";

  const lhsCompiled = compileImplicitSide(lhsSource, "left-hand side", params);
  if (lhsCompiled.error) {
    const errorResult = { evaluator: () => Number.NaN, error: lhsCompiled.error };
    setCachedImplicitSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  const rhsCompiled = compileImplicitSide(rhsSource, "right-hand side", params);
  if (rhsCompiled.error) {
    const errorResult = { evaluator: () => Number.NaN, error: rhsCompiled.error };
    setCachedImplicitSurfaceCompile(cacheKey, errorResult);
    return errorResult;
  }

  const evaluator: ImplicitSurfaceEvaluator = (x, y, z) => {
    const left = evaluateImplicitSide(lhsCompiled.expression, x, y, z, params);
    const right = evaluateImplicitSide(rhsCompiled.expression, x, y, z, params);
    const difference = left - right;
    return Number.isFinite(difference) ? difference : Number.NaN;
  };

  evaluator.sampleGrid = (domain, resolution) => {
    if (!Number.isInteger(resolution) || resolution < 2 || resolution > MAX_IMPLICIT_SURFACE_RESOLUTION) throw new Error("Invalid implicit sample resolution.");
    return sampleRustGrid(lhsCompiled.expression!, rhsCompiled.expression!, params, [
      { symbol: "x", min: domain.xMin, max: domain.xMax, count: resolution + 1 },
      { symbol: "y", min: domain.yMin, max: domain.yMax, count: resolution + 1 },
      { symbol: "z", min: domain.zMin, max: domain.zMax, count: resolution + 1 }
    ]);
  };

  const successResult: CompiledImplicitSurfaceExpression = {
    evaluator,
    error: null,
    samplePlaneGrid: (horizontal, vertical, hMin, hMax, columns, vMin, vMax, rows) => {
      if (horizontal === vertical || ![columns, rows].every(count => Number.isInteger(count) && count > 0 && count <= 1024)) throw new Error("Invalid contour grid dimensions or axes.");
      const omitted = (["x", "y", "z"] as const).find(axis => axis !== horizontal && axis !== vertical)!;
      return sampleRustGrid(lhsCompiled.expression!, rhsCompiled.expression!, params, [
        { symbol: horizontal, min: hMin, max: hMax, count: columns },
        { symbol: vertical, min: vMin, max: vMax, count: rows },
        { symbol: omitted, min: 0, max: 0, count: 1 }
      ]);
    },
    sampleXYGrid: (xMin, xMax, columns, yMin, yMax, rows) => successResult.samplePlaneGrid!("x", "y", xMin, xMax, columns, yMin, yMax, rows)
  };
  setCachedImplicitSurfaceCompile(cacheKey, successResult);
  return successResult;
}

/** Bounded Rust batches avoid a JS/WASM boundary crossing for every sample. */
function sampleRustGrid(left: CompiledRustExpression, right: CompiledRustExpression, params: Record<string, number>, axes: Parameters<CompiledRustExpression["evaluateGrid"]>[0]): Float64Array {
  const [xAxis, yAxis, zAxis] = axes;
  const values = new Float64Array(xAxis.count * yAxis.count * zAxis.count);
  const tileX = Math.min(32, xAxis.count), tileY = Math.min(32, yAxis.count);
  const tileZ = Math.min(32, Math.floor(2048 / (tileX * tileY)));
  const at = (axis: typeof xAxis, index: number) => axis.count === 1 ? axis.min : axis.min + (axis.max - axis.min) * index / (axis.count - 1);
  const scope = { ...params, x: 0, y: 0, z: 0 };
  for (let z = 0; z < zAxis.count; z += tileZ) for (let y = 0; y < yAxis.count; y += tileY) for (let x = 0; x < xAxis.count; x += tileX) {
    const offsets = [x, y, z], sizes = [Math.min(tileX, xAxis.count-x), Math.min(tileY, yAxis.count-y), Math.min(tileZ, zAxis.count-z)];
    const batch = axes.map((axis, index) => ({ symbol: axis.symbol, min: at(axis, offsets[index]), max: at(axis, offsets[index] + sizes[index]-1), count: sizes[index] })) as typeof axes;
    const a = left.evaluateGrid(batch, scope), b = right.evaluateGrid(batch, scope);
    for (let iz=0; iz<sizes[2]; iz++) for (let iy=0; iy<sizes[1]; iy++) for (let ix=0; ix<sizes[0]; ix++) {
      const source = (iz*sizes[1]+iy)*sizes[0]+ix;
      values[((z+iz)*yAxis.count+y+iy)*xAxis.count+x+ix] = a[source]-b[source];
    }
  }
  return values;
}

function compileImplicitSide(expr: string, label: string, params: Record<string, number>) {
  const trimmedExpr = expr.trim();
  if (!trimmedExpr) {
    return {
      expression: null,
      error: `Equation ${label} cannot be empty.`
    };
  }

  let parsedNode: MathNode;
  try {
    parsedNode = parse(trimmedExpr) as MathNode;
  } catch (error) {
    return {
      expression: null,
      error: formatExpressionError(error)
    };
  }

  // S18: `t` has no meaning in a 3D implicit field (unlike the 2D canvas,
  // which aliases it). Reject it explicitly: BASE policy allows `t`, and
  // without this check it would pass safety, compile, then evaluate to NaN
  // everywhere (undefined scope symbol) while diagnostics claims validity.
  // `u`/`v` need no such check — they already fail closed as unsupported
  // symbols. Function-call names (`sin(t)` is rejected anyway) are skipped
  // exactly like the safety layer skips `fn` paths.
  if (referencesReservedTimeSymbol(parsedNode)) {
    return {
      expression: null,
      error: "The symbol 't' is not supported in implicit surfaces; use x, y, z."
    };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    // S18: x/y/z are BASE-allowed locals (no policy change); editor
    // parameters ride allowedSymbols (S19: from the explicit snapshot, never
    // the store, so this module stays worker-safe).
    const safety = validateExpressionSafety(trimmedExpr, {
      operation: "compile-implicit-surface-side",
      expressionLabel: `Implicit surface ${label}`,
      allowedSymbols: Object.keys(params)
    });
    if (!safety.ok) {
      return {
        expression: null,
        error: safety.violation.message
      };
    }

    compiledExpression = compileRustExpression(parsedNode) as CompiledMathExpression;
  } catch (error) {
    return {
      expression: null,
      error: formatExpressionError(error)
    };
  }

  // S9: no execution probe here. Compilation answers only whether each side
  // is syntactically valid, permitted, and compilable; pointwise validity
  // (e.g. 1/x over x = 0) belongs to the scalar-grid sampler. Never probe at
  // the origin or any other fixed point.
  return {
    expression: compiledExpression,
    error: null
  };
}

function evaluateImplicitSide(
  expression: CompiledMathExpression | null,
  x: number,
  y: number,
  z: number,
  params: Record<string, number>
): number {
  if (!expression) {
    return Number.NaN;
  }

  try {
    // Locals win over same-named editor parameters.
    const value = expression.evaluate({ ...params, x, y, z });
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("Implicit surface evaluation failed", { x, y, z, error });
    }
    return Number.NaN;
  }
}

function referencesReservedTimeSymbol(node: MathNode): boolean {
  let found = false;
  node.traverse((childNode: MathNode, path: string) => {
    if (found || path === "fn") {
      return;
    }
    const maybeSymbol = childNode as unknown as { type?: string; isSymbolNode?: boolean; name?: unknown };
    const isSymbolNode = maybeSymbol.type === "SymbolNode" || Boolean(maybeSymbol.isSymbolNode);
    if (isSymbolNode && maybeSymbol.name === "t") {
      found = true;
    }
  });
  return found;
}

function formatExpressionError(error: unknown): string {
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
