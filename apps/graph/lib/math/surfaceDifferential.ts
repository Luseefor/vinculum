import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { compileImplicitSurfaceExpression } from "./compileImplicitSurface";
import { compileSurfaceExpression } from "./compileExpression";
import { compilePartialDerivative } from "./compilePartialDerivative";
import { getEffectiveSurfaceOrientation } from "./surfaceExpressionOrientation";
import { splitSingleMathEquality } from "./implicitEquation";

// S21 differential analysis core: pure level-set normalization, scalar
// gradients, tangent planes, and tangent bases. No React, no Three, no
// stores — the overlay renderer and Inspector consume these outputs.
//
// Central representation: every supported surface normalizes to a scalar
// level set G(x,y,z) = 0. Normal = ∇G(p); tangent plane =
// ∇G(p) · ((x,y,z) - p) = 0. Explicit surfaces define G = dep - f
// internally (never rewriting the canonical equation); implicit surfaces
// reuse the exact S18/S10 F = lhs - rhs semantics.

export interface MathPoint3 {
  x: number;
  y: number;
  z: number;
}

export type SurfaceLevelSet =
  | { kind: "explicit"; orientation: "x" | "y" | "z"; body: string; independentVars: [string, string] }
  | { kind: "implicit"; lhs: string; rhs: string };

export function normalizeSurfaceLevelSet(
  object: SurfaceGraphObject | ImplicitSurfaceObject
): SurfaceLevelSet | { error: string } {
  if (object.kind === "implicitSurface") {
    const raw = object.equation.trim();
    if (!raw) {
      return { error: "Equation cannot be empty." };
    }
    const parts = splitSingleMathEquality(raw);
    if (!parts) {
      // Bare field (no '=') is the level set directly; a chained '='
      // alongside a null split is malformed (mirrors compileImplicitSurface).
      if (raw.includes("=")) {
        return { error: "Equation must contain exactly one '='." };
      }
      return { kind: "implicit", lhs: raw, rhs: "0" };
    }
    return { kind: "implicit", lhs: parts.lhs, rhs: parts.rhs };
  }

  const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(
    object.equation,
    object.orientation ?? "z"
  );
  if (!body) {
    return { error: "Equation cannot be empty." };
  }
  const independentVars: [string, string] =
    effectiveOrientation === "x" ? ["y", "z"] : effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
  return { kind: "explicit", orientation: effectiveOrientation, body, independentVars };
}

interface ScalarPartial {
  evaluate: (scope: Record<string, number>) => number;
}

export interface CompiledScalarGradient {
  partials: Record<"x" | "y" | "z", ScalarPartial>;
  error: string | null;
}

// Compiles ∂G/∂x, ∂G/∂y, ∂G/∂z for the level set. Explicit dependent axes
// contribute the constant ±1 (G = dep - f); implicit sides subtract by
// linearity of differentiation (exactly the S18 evaluator semantics).
export function compileScalarGradient(
  levelSet: SurfaceLevelSet,
  params: Record<string, number>
): CompiledScalarGradient {
  const allowedSymbols = Object.keys(params);
  const partial = (expression: string, variable: string) =>
    compilePartialDerivative({ expression, variable, allowedSymbols, params });

  if (levelSet.kind === "explicit") {
    const [u, v] = levelSet.independentVars;
    const du = partial(levelSet.body, u);
    if (du.error) {
      return { partials: nanGradient(), error: du.error };
    }
    const dv = partial(levelSet.body, v);
    if (dv.error) {
      return { partials: nanGradient(), error: dv.error };
    }
    const negate = (fn: ScalarPartial): ScalarPartial => ({
      evaluate: (scope) => {
        const value = fn.evaluate(scope);
        return Number.isFinite(value) ? -value : Number.NaN;
      }
    });
    const one: ScalarPartial = { evaluate: () => 1 };
    if (levelSet.orientation === "x") {
      return { partials: { x: one, y: negate(du), z: negate(dv) }, error: null };
    }
    if (levelSet.orientation === "y") {
      return { partials: { x: negate(du), y: one, z: negate(dv) }, error: null };
    }
    return { partials: { x: negate(du), y: negate(dv), z: one }, error: null };
  }

  const partials: Record<"x" | "y" | "z", ScalarPartial> = { x: nanPartial(), y: nanPartial(), z: nanPartial() };
  for (const variable of ["x", "y", "z"] as const) {
    const left = partial(levelSet.lhs, variable);
    if (left.error) {
      return { partials: nanGradient(), error: left.error };
    }
    const right = partial(levelSet.rhs, variable);
    if (right.error) {
      return { partials: nanGradient(), error: right.error };
    }
    partials[variable] = {
      evaluate: (scope) => {
        const a = left.evaluate(scope);
        const b = right.evaluate(scope);
        const value = a - b;
        return Number.isFinite(value) ? value : Number.NaN;
      }
    };
  }
  return { partials, error: null };
}

function nanPartial(): ScalarPartial {
  return { evaluate: () => Number.NaN };
}

function nanGradient(): Record<"x" | "y" | "z", ScalarPartial> {
  return { x: nanPartial(), y: nanPartial(), z: nanPartial() };
}

export interface SurfaceGradient {
  x: number;
  y: number;
  z: number;
}

// Evaluates the compiled gradient at a math point. Scope mirrors the
// source compilers ({x,y,z,t,pi,e} defaults, params, point last so locals
// win). Non-finite in any component → unavailable (never NaN out).
export function evaluateSurfaceGradient(
  compiled: CompiledScalarGradient,
  point: MathPoint3,
  params: Record<string, number>,
  extraScope: Record<string, number> = {}
): { ok: true; gradient: SurfaceGradient } | { ok: false } {
  // Locals win over same-named parameters (S19 convention): point
  // coordinates apply last.
  const scope: Record<string, number> = {
    x: 0,
    y: 0,
    z: 0,
    t: 0,
    pi: Math.PI,
    e: Math.E,
    ...params,
    ...extraScope
  };
  scope.x = point.x;
  scope.y = point.y;
  scope.z = point.z;
  const gradient = {
    x: compiled.partials.x.evaluate(scope),
    y: compiled.partials.y.evaluate(scope),
    z: compiled.partials.z.evaluate(scope)
  };
  if (!Number.isFinite(gradient.x) || !Number.isFinite(gradient.y) || !Number.isFinite(gradient.z)) {
    return { ok: false };
  }
  return { ok: true, gradient };
}

// Gradients below this magnitude are treated as zero (critical point):
// f64 partials of O(1)-coefficient equations live orders of magnitude
// above it, while 1e-13-scale values are rounding noise. Scale limitation
// (documented): pathologically tiny coefficients (e.g. z = 1e-15*x) also
// report zero-gradient rather than a noise plane — fail closed by design.
export const GRADIENT_ZERO_EPS = 1e-12;

export interface TangentPlane {
  normal: SurfaceGradient;
  unitNormal: SurfaceGradient;
  point: MathPoint3;
  basisT1: SurfaceGradient;
  basisT2: SurfaceGradient;
}

// Builds the tangent plane projector from a finite gradient. Zero
// gradients produce the explicit critical-point outcome (no fake plane,
// no NaN quaternion downstream).
export function tangentPlaneFromGradient(
  point: MathPoint3,
  gradient: SurfaceGradient
): { ok: true; plane: TangentPlane } | { ok: false; reason: "zero-gradient" } {
  const length = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y + gradient.z * gradient.z);
  if (!(length > GRADIENT_ZERO_EPS) || !Number.isFinite(length)) {
    return { ok: false, reason: "zero-gradient" };
  }
  const unitNormal: SurfaceGradient = {
    x: gradient.x / length,
    y: gradient.y / length,
    z: gradient.z / length
  };
  const basis = tangentBasisFromNormal(unitNormal);
  if (!basis) {
    return { ok: false, reason: "zero-gradient" };
  }
  return {
    ok: true,
    plane: {
      normal: { ...gradient },
      unitNormal,
      point: { ...point },
      basisT1: basis.t1,
      basisT2: basis.t2
    }
  };
}

// Stable orthonormal tangent basis: helper = least-aligned coordinate
// axis, t1 = normalize(cross(n, helper)), t2 = cross(n, t1). Requires a
// nonzero (ideally unit) normal; returns null otherwise.
export function tangentBasisFromNormal(normal: SurfaceGradient): {
  t1: SurfaceGradient;
  t2: SurfaceGradient;
} | null {
  const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  if (!(length > GRADIENT_ZERO_EPS) || !Number.isFinite(length)) {
    return null;
  }
  const n = { x: normal.x / length, y: normal.y / length, z: normal.z / length };
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  const helper = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } : ay <= az ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  const t1 = normalizeVec(cross(n, helper));
  if (!t1) {
    return null;
  }
  const t2 = cross(n, t1);
  return { t1, t2 };
}

function cross(a: SurfaceGradient, b: SurfaceGradient): SurfaceGradient {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function normalizeVec(v: SurfaceGradient): SurfaceGradient | null {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (!(length > GRADIENT_ZERO_EPS) || !Number.isFinite(length)) {
    return null;
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

// Geometric point validity: |G(p)| / |∇G(p)| estimates distance from the
// surface. Valid within 5% of the local sample spacing (marching-tetra
// interpolation tolerance, PART 28). Explicit meshes pass trivially.
export function isAnalysisPointOnSurface(
  gValue: number,
  gradient: SurfaceGradient,
  sampleSpacing: number
): boolean {
  const gradLength = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y + gradient.z * gradient.z);
  if (!(gradLength > GRADIENT_ZERO_EPS) || !Number.isFinite(gValue)) {
    return false;
  }
  if (!(sampleSpacing > 0) || !Number.isFinite(sampleSpacing)) {
    return Math.abs(gValue) <= 1e-6;
  }
  return Math.abs(gValue) / gradLength <= 0.05 * sampleSpacing;
}

// Local sample spacing from a surface domain + resolution (min axis
// extent / resolution). Used for the validity tolerance above.
export function surfaceSampleSpacing(
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number },
  resolution: number,
  isVolumetric: boolean
): number {
  if (!Number.isFinite(resolution) || resolution < 1) {
    return 0;
  }
  const extents = [domain.xMax - domain.xMin, domain.yMax - domain.yMin];
  if (isVolumetric && domain.zMin !== undefined && domain.zMax !== undefined) {
    extents.push(domain.zMax - domain.zMin);
  }
  let min = Number.POSITIVE_INFINITY;
  for (const extent of extents) {
    // Absolute extents: inverted domains (min > max) still sample backward,
    // so tolerance uses the geometric span, never a negative value.
    const span = Math.abs(extent);
    if (!Number.isFinite(span)) {
      return 0;
    }
    if (span < min) {
      min = span;
    }
  }
  return min > 0 ? min / resolution : 0;
}

export type SurfaceAnalysisOutcome =
  | {
      status: "ok";
      gradient: SurfaceGradient;
      unitNormal: SurfaceGradient;
      plane: TangentPlane;
      gValue: number;
    }
  | { status: "derivative-unavailable"; error: string }
  | { status: "non-finite" }
  | { status: "zero-gradient" }
  | { status: "off-surface" }
  | { status: "invalid-source"; error: string };

// Single pure analysis computation shared by the overlay sync and the
// Inspector (guaranteed agreement: same input, same function). Validates
// the source through the same compilers as the render sync gate first, so
// analysis can never run on mathematics the renderer rejected.
export function computeSurfaceAnalysis(
  object: SurfaceGraphObject | ImplicitSurfaceObject,
  point: MathPoint3,
  params: Record<string, number>
): SurfaceAnalysisOutcome {
  if (object.kind === "surface") {
    const source = compileSurfaceExpression(object.equation, object.orientation ?? "z");
    if (source.error) {
      return { status: "invalid-source", error: source.error };
    }
  } else {
    const source = compileImplicitSurfaceExpression(object.equation, params);
    if (source.error) {
      return { status: "invalid-source", error: source.error };
    }
  }

  const levelSet = normalizeSurfaceLevelSet(object);
  if ("error" in levelSet) {
    return { status: "invalid-source", error: levelSet.error };
  }

  const compiled = compileScalarGradient(levelSet, params);
  if (compiled.error) {
    return { status: "derivative-unavailable", error: compiled.error };
  }
  const evaluated = evaluateSurfaceGradient(compiled, point, params);
  if (!evaluated.ok) {
    return { status: "non-finite" };
  }

  // Zero gradient first: a critical point on the surface (cone apex) must
  // report "gradient is zero", not "point left the surface" — the residual
  // check below cannot validate without a gradient direction.
  const gradLength = Math.sqrt(
    evaluated.gradient.x * evaluated.gradient.x +
      evaluated.gradient.y * evaluated.gradient.y +
      evaluated.gradient.z * evaluated.gradient.z
  );
  if (!(gradLength > GRADIENT_ZERO_EPS) || !Number.isFinite(gradLength)) {
    return { status: "zero-gradient" };
  }

  const gValue = evaluateLevelSet(
    object,
    levelSet,
    point,
    params,
    object.kind === "surface" ? (object.orientation ?? "z") : "z"
  );
  if (gValue === null) {
    return { status: "non-finite" };
  }
  const spacing = surfaceSampleSpacing(
    object.domain,
    object.resolution,
    object.kind === "implicitSurface"
  );
  if (!isAnalysisPointOnSurface(gValue, evaluated.gradient, spacing)) {
    return { status: "off-surface" };
  }

  const plane = tangentPlaneFromGradient(point, evaluated.gradient);
  if (!plane.ok) {
    return { status: "zero-gradient" };
  }
  return {
    status: "ok",
    gradient: evaluated.gradient,
    unitNormal: plane.plane.unitNormal,
    plane: plane.plane,
    gValue
  };
}

// Level-set residual G(p): explicit surfaces evaluate dep - f at the
// point's independent coordinates; implicit surfaces reuse the S18
// evaluator (F = lhs - rhs) directly.
function evaluateLevelSet(
  object: SurfaceGraphObject | ImplicitSurfaceObject,
  levelSet: SurfaceLevelSet,
  point: MathPoint3,
  params: Record<string, number>,
  orientation: "x" | "y" | "z"
): number | null {
  if (levelSet.kind === "implicit") {
    const compiled = compileImplicitSurfaceExpression(object.equation, params);
    if (compiled.error) {
      return null;
    }
    const value = compiled.evaluator(point.x, point.y, point.z);
    return Number.isFinite(value) ? value : null;
  }
  const source = compileSurfaceExpression(object.equation, orientation);
  if (source.error) {
    return null;
  }
  const [u, v] =
    levelSet.orientation === "x"
      ? [point.y, point.z]
      : levelSet.orientation === "y"
        ? [point.x, point.z]
        : [point.x, point.y];
  const f = source.evaluator(u, v);
  if (!Number.isFinite(f)) {
    return null;
  }
  const dep = levelSet.orientation === "x" ? point.x : levelSet.orientation === "y" ? point.y : point.z;
  const value = dep - f;
  return Number.isFinite(value) ? value : null;
}
