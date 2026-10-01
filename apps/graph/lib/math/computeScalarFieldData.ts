import { compileRustExpression as compile } from "./rustMath";
import { compileImplicitSurfaceExpression } from "./compileImplicitSurface";
import { compileScalarFunctionGradient } from "./surfaceDifferential";
import { validateExpressionSafety } from "./expressionSafety";
import { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";
import { sampleScalarGrid, type ScalarGridDomain } from "./scalarFieldSample";
import { computeContourLevels, extractContours } from "./marchingSquares";

// S23 pure scalar-field compute core: compile → sample → levels →
// contours → (optionally) dense gradients. No React/Three/stores/DOM —
// the same function runs in the S19 worker and in unit tests (parity is
// structural). Only structured-clone-safe data crosses the worker
// boundary; evaluators never cross.
//
// Source rules (PART 41, S22 semantics are canonical):
// - explicit surfaces supply the scalar body f over their independent
//   variables (z=f(x,y), x=f(y,z), y=f(x,z)); the body compiles through
//   the S11 pipeline with parameter keys as allowed symbols;
// - implicit surfaces supply F(x,y,z) through the S18 compiler;
// - dense gradients MUST use the S21 partial-derivative engine
//   (compileScalarFunctionGradient) — never finite differences. If the
//   derivative is unavailable, heat/contours still succeed and the
//   gradient reports "unavailable" (PART 42 separation).
// - domain2D targets require explicit sources; slice targets require
//   implicit sources. Anything else is a clean error, never a forced
//   interpretation.

export type ScalarFieldSource =
  | { kind: "surface"; equation: string; orientation: "x" | "y" | "z" }
  | { kind: "implicit"; equation: string };

export type ScalarFieldTarget =
  | { kind: "domain2D"; domain: ScalarGridDomain }
  | { kind: "slice"; plane: "xy" | "xz" | "yz"; planeValue: number; domain: ScalarGridDomain };

export interface ScalarFieldComputeInput {
  source: ScalarFieldSource;
  target: ScalarFieldTarget;
  /** Grid resolution (nodes per axis = resolution + 1); clamped internally. */
  resolution: number;
  /** Automatic contour level count (0 disables contour extraction). */
  contourCount: number;
  /** Gradient samples per axis (0 disables the gradient grid). */
  gradientDensity: number;
  params: Record<string, number>;
}

export type ScalarGradientStatus = "ok" | "skipped" | "unavailable" | "empty";

export type ScalarFieldComputeResult =
  | {
      status: "ok";
      values: Float32Array;
      valid: Uint8Array;
      width: number;
      height: number;
      domain: ScalarGridDomain;
      min: number;
      max: number;
      validCount: number;
      totalSamples: number;
      levels: Float32Array;
      contourSegments: Float32Array;
      contourSegmentCount: number;
      contourStatus: "ok" | "empty" | "degenerate" | "budget-exceeded";
      gradientPositions: Float32Array;
      gradientVectors: Float32Array;
      gradientMagnitudes: Float32Array;
      gradientValidCount: number;
      gradientMaxMagnitude: number;
      gradientStatus: ScalarGradientStatus;
    }
  | { status: "empty" }
  | { status: "error"; error: string };

// Dense gradient overlay bounds (PART 29): glyph-count parity with the S20
// 2D vector budget (<= 32^2). The default keeps typical bowls readable
// without clutter; the Inspector exposes density only.
export const MIN_SCALAR_GRADIENT_DENSITY = 4;
export const MAX_SCALAR_GRADIENT_DENSITY = 24;
export const DEFAULT_SCALAR_GRADIENT_DENSITY = 12;

interface CompiledScalar {
  evaluate: (u: number, v: number) => number;
  /** Independent variable names in (u, v) order. */
  vars: [string, string];
  /** Full math coordinate of a grid node (slice targets fix one axis). */
  mathPoint: (u: number, v: number) => { x: number; y: number; z: number };
}

export function computeScalarFieldData(input: ScalarFieldComputeInput): ScalarFieldComputeResult {
  const compiled = compileScalarSource(input.source, input.target, input.params);
  if (compiled.error || !compiled.evaluate) {
    return { status: "error", error: compiled.error ?? "Scalar source could not be compiled." };
  }
  const domain = input.target.domain;
  const grid = sampleScalarGrid(compiled.evaluate, domain, input.resolution);
  if (grid.validCount === 0) {
    return { status: "empty" };
  }

  const contourCount = Math.floor(input.contourCount);
  let levels: Float32Array = new Float32Array(0);
  let contourSegments: Float32Array = new Float32Array(0);
  let contourSegmentCount = 0;
  let contourStatus: "ok" | "empty" | "degenerate" | "budget-exceeded" = "empty";
  if (contourCount > 0) {
    levels = computeContourLevels(grid.min, grid.max, contourCount);
    const extracted = extractContours(grid, domain, levels);
    contourSegments = extracted.segments;
    contourSegmentCount = extracted.segmentCount;
    contourStatus = extracted.status;
    if (contourStatus === "budget-exceeded") {
      levels = new Float32Array(0);
      contourSegments = new Float32Array(0);
      contourSegmentCount = 0;
    }
  }

  const gradient = sampleScalarGradient(
    { evaluate: compiled.evaluate, vars: compiled.vars, mathPoint: compiled.mathPoint },
    input,
    domain
  );

  return {
    status: "ok",
    values: grid.values,
    valid: grid.valid,
    width: grid.width,
    height: grid.height,
    domain: { ...domain },
    min: grid.min,
    max: grid.max,
    validCount: grid.validCount,
    totalSamples: grid.totalSamples,
    levels,
    contourSegments,
    contourSegmentCount,
    contourStatus,
    gradientPositions: gradient.positions,
    gradientVectors: gradient.vectors,
    gradientMagnitudes: gradient.magnitudes,
    gradientValidCount: gradient.validCount,
    gradientMaxMagnitude: gradient.maxMagnitude,
    gradientStatus: gradient.status
  };
}

function compileScalarSource(
  source: ScalarFieldSource,
  target: ScalarFieldTarget,
  params: Record<string, number>
): { evaluate: ((u: number, v: number) => number) | null; vars: [string, string]; mathPoint: (u: number, v: number) => { x: number; y: number; z: number }; error: string | null } {
  if (source.kind === "surface") {
    if (target.kind !== "domain2D") {
      return {
        evaluate: null,
        vars: ["x", "y"],
        mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
        error: "Planar slices require an implicit scalar source."
      };
    }
    const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(
      source.equation,
      source.orientation
    );
    if (!body) {
      return {
        evaluate: null,
        vars: ["x", "y"],
        mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
        error: "Equation cannot be empty."
      };
    }
    const safety = validateExpressionSafety(body, {
      operation: "compute-scalar-field-source",
      expressionLabel: "Scalar field",
      allowedSymbols: Object.keys(params)
    });
    if (!safety.ok) {
      return {
        evaluate: null,
        vars: ["x", "y"],
        mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
        error: safety.violation.message
      };
    }
    let compiled: { evaluate: (scope: Record<string, number>) => unknown };
    try {
      compiled = compile(body) as { evaluate: (scope: Record<string, number>) => unknown };
    } catch {
      return {
        evaluate: null,
        vars: ["x", "y"],
        mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
        error: "Scalar expression could not be compiled."
      };
    }
    const vars: [string, string] =
      effectiveOrientation === "x" ? ["y", "z"] : effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
    const mathPoint = (u: number, v: number) =>
      effectiveOrientation === "x"
        ? { x: 0, y: u, z: v }
        : effectiveOrientation === "y"
          ? { x: u, y: 0, z: v }
          : { x: u, y: v, z: 0 };
    return {
      evaluate: (u, v) => {
        try {
          // S23-R1: same scope policy as compileSurfaceExpression — full
          // x/y/z/t/pi/e defaults with params under, independent-variable
          // locals winning (S19 convention). The gradient path below uses
          // identical defaults, so heat and gradients agree on t-expressions.
          const scope: Record<string, number> = {
            x: 0,
            y: 0,
            z: 0,
            t: 0,
            pi: Math.PI,
            e: Math.E,
            ...params
          };
          scope[vars[0] as string] = u;
          scope[vars[1] as string] = v;
          const value = compiled.evaluate(scope);
          const numeric = typeof value === "number" ? value : Number(value);
          return Number.isFinite(numeric) ? numeric : Number.NaN;
        } catch {
          return Number.NaN;
        }
      },
      vars,
      mathPoint,
      error: null
    };
  }
  if (target.kind !== "slice") {
    return {
      evaluate: null,
      vars: ["x", "y"],
      mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
      error: "2D scalar grids require an explicit scalar source."
    };
  }
  const compiled = compileImplicitSurfaceExpression(source.equation, params);
  if (compiled.error) {
    return {
      evaluate: null,
      vars: ["x", "y"],
      mathPoint: (u, v) => ({ x: u, y: v, z: 0 }),
      error: compiled.error
    };
  }
  const plane = target.plane;
  const held = target.planeValue;
  const vars: [string, string] = plane === "xy" ? ["x", "y"] : plane === "xz" ? ["x", "z"] : ["y", "z"];
  return {
    evaluate: (u, v) => {
      const point =
        plane === "xy" ? { x: u, y: v, z: held } : plane === "xz" ? { x: u, y: held, z: v } : { x: held, y: u, z: v };
      return compiled.evaluator(point.x, point.y, point.z);
    },
    vars,
    mathPoint: (u, v) =>
      plane === "xy" ? { x: u, y: v, z: held } : plane === "xz" ? { x: u, y: held, z: v } : { x: held, y: u, z: v },
    error: null
  };
}

function sampleScalarGradient(
  compiled: CompiledScalar,
  input: ScalarFieldComputeInput,
  domain: ScalarGridDomain
): {
  positions: Float32Array;
  vectors: Float32Array;
  magnitudes: Float32Array;
  validCount: number;
  maxMagnitude: number;
  status: ScalarGradientStatus;
} {
  const empty = {
    positions: new Float32Array(0),
    vectors: new Float32Array(0),
    magnitudes: new Float32Array(0),
    validCount: 0,
    maxMagnitude: 0,
    status: "skipped" as ScalarGradientStatus
  };
  // Gradient overlays exist for 2D explicit scalar functions only (PART 6:
  // 3D gradient slices are out of scope; the worker reports skipped and
  // the Inspector hides the toggle).
  if (input.target.kind !== "domain2D" || input.source.kind !== "surface") {
    return empty;
  }
  const density = Math.floor(input.gradientDensity);
  if (!(density > 0)) {
    return empty;
  }
  if (
    density < MIN_SCALAR_GRADIENT_DENSITY ||
    density > MAX_SCALAR_GRADIENT_DENSITY ||
    !Number.isFinite(domain.uMin) ||
    !Number.isFinite(domain.uMax) ||
    !Number.isFinite(domain.vMin) ||
    !Number.isFinite(domain.vMax)
  ) {
    return { ...empty, status: "skipped" };
  }
  // S21 engine, same policy as the Inspector directional derivative:
  // unsupported derivatives isolate to "unavailable" while heat/contours
  // (already computed above) stay valid.
  const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(
    (input.source as { equation: string }).equation,
    (input.source as { orientation: "x" | "y" | "z" }).orientation
  );
  if (!body) {
    return { ...empty, status: "skipped" };
  }
  const independentVars: [string, string] =
    effectiveOrientation === "x" ? ["y", "z"] : effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
  const gradient = compileScalarFunctionGradient(
    { kind: "explicit", orientation: effectiveOrientation, body, independentVars },
    input.params
  );
  if (gradient.error) {
    return { ...empty, status: "unavailable" };
  }
  const positions: number[] = [];
  const vectors: number[] = [];
  const magnitudes: number[] = [];
  let maxMagnitude = 0;
  const uStep = (domain.uMax - domain.uMin) / Math.max(1, density - 1);
  const vStep = (domain.vMax - domain.vMin) / Math.max(1, density - 1);
  for (let j = 0; j < density; j += 1) {
    const v = domain.vMin + j * vStep;
    for (let i = 0; i < density; i += 1) {
      const u = domain.uMin + i * uStep;
      const point = compiled.mathPoint(u, v);
      const scope: Record<string, number> = {
        x: 0,
        y: 0,
        z: 0,
        t: 0,
        pi: Math.PI,
        e: Math.E,
        ...input.params
      };
      scope.x = point.x;
      scope.y = point.y;
      scope.z = point.z;
      const gx = gradient.du.evaluate(scope);
      const gy = gradient.dv.evaluate(scope);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
        continue;
      }
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (!Number.isFinite(magnitude)) {
        continue;
      }
      positions.push(u, v, 0);
      vectors.push(gx, gy, 0);
      magnitudes.push(magnitude);
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }
  }
  if (magnitudes.length === 0) {
    return { ...empty, status: "empty" };
  }
  return {
    positions: new Float32Array(positions),
    vectors: new Float32Array(vectors),
    magnitudes: new Float32Array(magnitudes),
    validCount: magnitudes.length,
    maxMagnitude,
    status: "ok"
  };
}


