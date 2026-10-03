// S27 geometric tolerance policy (PART 4): ONE centralized,
// scale-aware convention for every relation classification. No local
// 1e-6/1e-8/1e-12 branches inside relation functions.
//
// Policy: tol(scale) = ABS_TOL + REL_TOL * scale, where scale derives
// from the relevant coordinate magnitudes / vector lengths / distance
// scales at each call site. Absolute tolerance alone misclassifies at
// 1e-6 and 1e6 scene scales; the relative term keeps angular-equivalent
// decisions coherent across scales.
//
// Boundary with S26: GEOMETRY_ZERO_MAGNITUDE_SQUARED (1e-24) remains the
// existence/degeneracy test (zero direction, coincident endpoints). This
// module governs CLASSIFICATION (parallel, touching, intersecting).
//
// Threshold characterization (pinned in tests):
// - direction pairs ~1e-7 rad apart: NOT parallel
// - direction pairs ~1e-12 rad apart: parallel
// i.e. the effective angular threshold sits near 1e-9 rad.

export const GEOMETRY_REL_TOL = 1e-9;
export const GEOMETRY_ABS_TOL = 1e-12;

/** Scale-aware tolerance: absTol + relTol * |scale|. Scale must be finite. */
export function geometryTolerance(scale: number): number {
  const finiteScale = Number.isFinite(scale) ? Math.abs(scale) : 0;
  return GEOMETRY_ABS_TOL + GEOMETRY_REL_TOL * finiteScale;
}

/** True when |value| is negligible against the given scale. */
export function approximatelyZero(value: number, scale: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  return Math.abs(value) <= geometryTolerance(scale);
}

/** True when a and b agree within tolerance at the given scale. */
export function approximatelyEqual(a: number, b: number, scale: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }
  return Math.abs(a - b) <= geometryTolerance(scale);
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

function dot(a: Vec3Like, b: Vec3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3Like, b: Vec3Like): Vec3Like {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function magnitude(v: Vec3Like): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Parallel directions (either orientation). The comparison is PURELY
 * relative — sinθ = |u×v|/(|u||v|) ≤ REL_TOL — because direction
 * classification is dimensionless: an absolute floor would swallow the
 * signal at 1e-6 scene scales (S27-R2: perpendicular micro-vectors
 * misclassified parallel). Degenerate inputs are rejected upstream by
 * the S26 absolute existence test; zero or non-finite inputs here are
 * never parallel. Overflow-guarded for extreme magnitudes.
 */
export function vectorsParallel(u: Vec3Like, v: Vec3Like): boolean {
  const mu = magnitude(u);
  const mv = magnitude(v);
  if (!Number.isFinite(mu) || !Number.isFinite(mv) || mu === 0 || mv === 0) {
    return false;
  }
  const product = mu * mv;
  if (!Number.isFinite(product) || product === 0) {
    return false;
  }
  return magnitude(cross(u, v)) <= GEOMETRY_REL_TOL * product;
}

/**
 * Perpendicular directions: |u·v|/(|u||v|) ≤ REL_TOL. Purely relative
 * for the same scale-invariance reason as vectorsParallel.
 * Classification only — in 3D, skew lines can hold perpendicular
 * DIRECTIONS without intersecting, so callers must not label skew pairs
 * "perpendicular lines" (relation output keeps directions vs
 * intersection separate).
 */
export function vectorsPerpendicular(u: Vec3Like, v: Vec3Like): boolean {
  const mu = magnitude(u);
  const mv = magnitude(v);
  if (!Number.isFinite(mu) || !Number.isFinite(mv) || mu === 0 || mv === 0) {
    return false;
  }
  const product = mu * mv;
  if (!Number.isFinite(product) || product === 0) {
    return false;
  }
  return Math.abs(dot(u, v)) <= GEOMETRY_REL_TOL * product;
}

/** Coordinate scale of a point set: max |component|, floored at 1. */
export function coordinateScale(points: readonly Vec3Like[]): number {
  let scale = 1;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      return Number.NaN;
    }
    scale = Math.max(scale, Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
  }
  return scale;
}
