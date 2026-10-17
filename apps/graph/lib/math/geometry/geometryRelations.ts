// S27 Euclidean relation kernel: projections, distances, angles,
// parallel/perpendicular classification, and intersections over canonical
// Point / Vector / Line / Ray / Segment / Plane mathematics.
//
// Mandatory boundaries (PART 42, CENTRAL PRINCIPLE):
// - ALL math in CANONICAL MATH coordinates. No mathToWorld3D,
//   worldToMath3D, THREE.Vector3 anywhere in this module.
// - Relations consume canonical INFINITE mathematics (P + t·d, t ∈ R),
//   never renderer-clipped display endpoints.
// - No workers, no camera dependence, no sampling loops.
// - Tolerances come ONLY from geometryTolerance (PART 4); no scattered
//   local epsilons. Parallel classification reuses vectorsParallel /
//   vectorsPerpendicular so the kernel threshold always matches the
//   documented ~1e-9 rad policy.
//
// Closest-points method (PART 16): exact analytic minimization of the
// convex quadratic distance over the parameter rectangle — interior
// critical point when feasible, otherwise exact 1D minima over each
// finite-boundary edge (corners emerge as clamped edge solutions). This
// is the standard Ericson (Real-Time Collision Detection, §5.1.9)
// segment-segment derivation generalized to arbitrary [tMin,tMax]
// intervals (lines carry ±Infinity bounds, whose edges are skipped).
// No invented clamp-once shortcut.

import {
  GEOMETRY_ABS_TOL,
  GEOMETRY_REL_TOL,
  approximatelyEqual,
  approximatelyZero,
  coordinateScale,
  vectorsParallel,
  vectorsPerpendicular,
  type Vec3Like
} from "./geometryTolerance";
import { isZeroVec3 } from "./geometryPrimitives";
import type { Line3, Ray3, Segment3 } from "./geometryPrimitives";
import type { ResolvedPlane3 } from "./geometryResolve";

export type MathPoint3 = Vec3Like;
export type MathVector3 = Vec3Like;

// ---------------------------------------------------------------------------
// Generic linear primitive (INTERNAL PURE MATH, PART 3). Scene objects
// never carry tMin/tMax; S26 canonical semantics are unchanged.
// ---------------------------------------------------------------------------

export interface LinearPrimitive3 {
  origin: MathPoint3;
  /** Guaranteed nonzero, finite. */
  direction: MathVector3;
  tMin: number;
  tMax: number;
}

export function linearFromLine(line: Line3): LinearPrimitive3 | null {
  if (isZeroVec3(line.direction)) {
    return null;
  }
  return {
    origin: { ...line.point },
    direction: { ...line.direction },
    tMin: Number.NEGATIVE_INFINITY,
    tMax: Number.POSITIVE_INFINITY
  };
}

export function linearFromRay(ray: Ray3): LinearPrimitive3 | null {
  if (isZeroVec3(ray.direction)) {
    return null;
  }
  return {
    origin: { ...ray.origin },
    direction: { ...ray.direction },
    tMin: 0,
    tMax: Number.POSITIVE_INFINITY
  };
}

export function linearFromSegment(segment: Segment3): LinearPrimitive3 | null {
  const direction = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
    z: segment.end.z - segment.start.z
  };
  if (isZeroVec3(direction)) {
    // Degenerate segment behaves point-like; callers reduce explicitly.
    return null;
  }
  return { origin: { ...segment.start }, direction, tMin: 0, tMax: 1 };
}

/** True for infinite lines (both bounds infinite). */
export function linearIsInfinite(prim: LinearPrimitive3): boolean {
  return prim.tMin === Number.NEGATIVE_INFINITY && prim.tMax === Number.POSITIVE_INFINITY;
}

function dot(a: Vec3Like, b: Vec3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function subtract(a: Vec3Like, b: Vec3Like): MathVector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function addScaled(point: MathPoint3, direction: MathVector3, t: number): MathPoint3 {
  return { x: point.x + direction.x * t, y: point.y + direction.y * t, z: point.z + direction.z * t };
}

function magnitudeSquared(v: Vec3Like): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

function magnitude(v: Vec3Like): number {
  return Math.sqrt(magnitudeSquared(v));
}

function allFinite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

function clampToInterval(t: number, tMin: number, tMax: number): number {
  if (t < tMin) {
    return tMin;
  }
  if (t > tMax) {
    return tMax;
  }
  return t;
}

/**
 * Parameter-domain acceptance with tolerance-aware endpoint handling
 * (PART 15): t inside [tMin,tMax] up to a small parameter tolerance so
 * exact endpoint hits (t = 0/1 within rounding) count as hits.
 */
export function intervalTolerance(tMin: number, tMax: number): number {
  const span = Number.isFinite(tMin) && Number.isFinite(tMax) ? Math.abs(tMax - tMin) : 0;
  // Centralized policy values (PART 4): no local literals.
  return GEOMETRY_ABS_TOL + GEOMETRY_REL_TOL * Math.max(1, span);
}

export function withinInterval(t: number, tMin: number, tMax: number): boolean {
  if (!Number.isFinite(t)) {
    return false;
  }
  const tol = intervalTolerance(tMin, tMax);
  return t >= tMin - tol && t <= tMax + tol;
}

// ---------------------------------------------------------------------------
// Point ↔ Point
// ---------------------------------------------------------------------------

export function distancePointPoint(a: MathPoint3, b: MathPoint3): number | null {
  if (!allFinite(a.x, a.y, a.z, b.x, b.y, b.z)) {
    return null;
  }
  return magnitude(subtract(b, a));
}

// ---------------------------------------------------------------------------
// Point → linear primitive projection (PART 6-8)
// ---------------------------------------------------------------------------

export type ProjectionBoundary = "interior" | "start" | "end" | "origin";

export interface PointProjection {
  point: MathPoint3;
  /** Unconstrained line parameter (for rays/segments: pre-clamp value). */
  parameter: number;
  distance: number;
  boundary: ProjectionBoundary;
}

/** Unconstrained projection onto the infinite line (PART 6). */
export function projectPointToLine(point: MathPoint3, line: { point: MathPoint3; direction: MathVector3 }): PointProjection | null {
  if (!allFinite(point.x, point.y, point.z, line.point.x, line.point.y, line.point.z)) {
    return null;
  }
  if (isZeroVec3(line.direction)) {
    return null;
  }
  // t = ((Q-P)·d)/(d·d) — exact for non-unit d (DO NOT NORMALIZE).
  const diff = subtract(point, line.point);
  const denom = dot(line.direction, line.direction);
  const t = dot(diff, line.direction) / denom;
  if (!Number.isFinite(t)) {
    return null;
  }
  const projected = addScaled(line.point, line.direction, t);
  return { point: projected, parameter: t, distance: magnitude(subtract(point, projected)), boundary: "interior" };
}

/** Closest point on a ray; behind-origin queries clamp to origin (PART 7). */
export function projectPointToRay(point: MathPoint3, ray: { origin: MathPoint3; direction: MathVector3 }): PointProjection | null {
  const unconstrained = projectPointToLine(point, { point: ray.origin, direction: ray.direction });
  if (!unconstrained) {
    return null;
  }
  if (unconstrained.parameter >= 0) {
    return unconstrained;
  }
  return {
    point: { ...ray.origin },
    parameter: unconstrained.parameter,
    distance: magnitude(subtract(point, ray.origin)),
    boundary: "origin"
  };
}

/** Closest point on a segment; degenerate segments answer A (PART 8). */
export function projectPointToSegment(
  point: MathPoint3,
  segment: { start: MathPoint3; end: MathPoint3 }
): PointProjection | null {
  if (!allFinite(point.x, point.y, point.z)) {
    return null;
  }
  const direction = subtract(segment.end, segment.start);
  if (isZeroVec3(direction)) {
    if (!allFinite(segment.start.x, segment.start.y, segment.start.z)) {
      return null;
    }
    return {
      point: { ...segment.start },
      parameter: 0,
      distance: magnitude(subtract(point, segment.start)),
      boundary: "start"
    };
  }
  const diff = subtract(point, segment.start);
  const denom = dot(direction, direction);
  const tLine = dot(diff, direction) / denom;
  if (!Number.isFinite(tLine)) {
    return null;
  }
  const t = clampToInterval(tLine, 0, 1);
  const projected = addScaled(segment.start, direction, t);
  return {
    point: projected,
    parameter: tLine,
    distance: magnitude(subtract(point, projected)),
    boundary: t <= 0 ? "start" : t >= 1 ? "end" : "interior"
  };
}

/** Generic dispatcher over the internal linear representation. */
export function projectPointToLinearPrimitive(point: MathPoint3, prim: LinearPrimitive3): PointProjection | null {
  const unconstrained = projectPointToLine(point, { point: prim.origin, direction: prim.direction });
  if (!unconstrained) {
    return null;
  }
  const t = clampToInterval(unconstrained.parameter, prim.tMin, prim.tMax);
  if (t === unconstrained.parameter || (!Number.isFinite(prim.tMin) && !Number.isFinite(prim.tMax))) {
    return unconstrained;
  }
  const projected = addScaled(prim.origin, prim.direction, t);
  // Boundary vocabulary matches the dedicated projectors: rays clamp to
  // "origin", segments to "start"/"end".
  const rayLike = prim.tMin === 0 && !Number.isFinite(prim.tMax);
  return {
    point: projected,
    parameter: unconstrained.parameter,
    distance: magnitude(subtract(point, projected)),
    boundary: t <= prim.tMin ? (rayLike ? "origin" : "start") : "end"
  };
}

// ---------------------------------------------------------------------------
// Point → plane projection (PART 9)
// ---------------------------------------------------------------------------

export interface PointPlaneProjection {
  projection: MathPoint3;
  distance: number;
  /** Signed along the plane normal orientation. */
  signedDistance: number;
}

export function projectPointToPlane(point: MathPoint3, plane: ResolvedPlane3): PointPlaneProjection | null {
  if (!allFinite(point.x, point.y, point.z, plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)) {
    return null;
  }
  const nn = dot(plane.normal, plane.normal);
  if (!(nn > 0) || !Number.isFinite(nn)) {
    return null;
  }
  // Signed distance (Q·n + c)/|n| with the plane's normal orientation;
  // projection Q − n·((Q·n + c)/(n·n)). Raw (non-unit) normals are exact.
  const signedNumerator = dot(point, plane.normal) + plane.constant;
  const signedDistance = signedNumerator / Math.sqrt(nn);
  if (!Number.isFinite(signedDistance)) {
    return null;
  }
  const scale = signedNumerator / nn;
  const projection = {
    x: point.x - plane.normal.x * scale,
    y: point.y - plane.normal.y * scale,
    z: point.z - plane.normal.z * scale
  };
  return { projection, distance: Math.abs(signedDistance), signedDistance };
}

/** Absolute point-plane distance (0 for on-plane points). */
export function distancePointPlane(point: MathPoint3, plane: ResolvedPlane3): number | null {
  const projected = projectPointToPlane(point, plane);
  return projected ? projected.distance : null;
}

// ---------------------------------------------------------------------------
// Angles (PART 10-13, 20). Radians internally; UI formats degrees.
// ---------------------------------------------------------------------------

/** Vector-vector angle; null (unavailable, never 0/NaN) on zero vectors. */
export function angleBetweenVectors(a: MathVector3, b: MathVector3): number | null {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (!Number.isFinite(ma) || !Number.isFinite(mb) || ma === 0 || mb === 0) {
    return null;
  }
  const cosine = Math.min(1, Math.max(-1, dot(a, b) / (ma * mb)));
  return Math.acos(cosine);
}

/**
 * Line-line angle: SMALLEST angle 0..π/2 (unoriented lines). d and −d
 * give 0 — pinned.
 */
export function angleBetweenLines(d1: MathVector3, d2: MathVector3): number | null {
  const m1 = magnitude(d1);
  const m2 = magnitude(d2);
  if (!Number.isFinite(m1) || !Number.isFinite(m2) || m1 === 0 || m2 === 0) {
    return null;
  }
  const cosine = Math.min(1, Math.max(-1, Math.abs(dot(d1, d2)) / (m1 * m2)));
  return Math.acos(cosine);
}

/** Line-plane angle 0..π/2 via |d·n| (0 = lying in plane, π/2 = perpendicular). */
export function angleLinePlane(direction: MathVector3, normal: MathVector3): number | null {
  const md = magnitude(direction);
  const mn = magnitude(normal);
  if (!Number.isFinite(md) || !Number.isFinite(mn) || md === 0 || mn === 0) {
    return null;
  }
  const sine = Math.min(1, Math.max(-1, Math.abs(dot(direction, normal)) / (md * mn)));
  return Math.asin(sine);
}

/** Plane-plane angle 0..π/2 via |n1·n2|. */
export function anglePlanePlane(n1: MathVector3, n2: MathVector3): number | null {
  return angleBetweenLines(n1, n2);
}

// ---------------------------------------------------------------------------
// Linear primitive ↔ plane intersection (PART 15)
// ---------------------------------------------------------------------------

export type LinearPlaneIntersection =
  | { kind: "point"; point: MathPoint3; parameter: number }
  | { kind: "contained" }
  | { kind: "parallel"; distance: number | null }
  | { kind: "outside-domain"; parameter: number };

export function intersectLinearPlane(prim: LinearPrimitive3, plane: ResolvedPlane3): LinearPlaneIntersection | null {
  if (
    !allFinite(
      prim.origin.x, prim.origin.y, prim.origin.z,
      prim.direction.x, prim.direction.y, prim.direction.z,
      plane.normal.x, plane.normal.y, plane.normal.z, plane.constant
    )
  ) {
    return null;
  }
  const normalMag = magnitude(plane.normal);
  if (!(normalMag > 0) || !Number.isFinite(normalMag)) {
    return null;
  }
  const denom = dot(plane.normal, prim.direction);
  // S27-R2: line-plane parallelism means direction PERPENDICULAR to the
  // normal (d·n≈0) — never direction-parallel-to-normal.
  if (vectorsPerpendicular(prim.direction, plane.normal)) {
    // Parallel case: origin in plane?
    const originDist = dot(prim.origin, plane.normal) + plane.constant;
    const inPlane = approximatelyZero(originDist, normalMag * coordinateScale([prim.origin]));
    if (!inPlane) {
      const distance = Math.abs(originDist) / normalMag;
      return { kind: "parallel", distance: Number.isFinite(distance) ? distance : null };
    }
    // Origin satisfies the plane: line/ray fully contained. A segment is
    // contained iff its far endpoint also lies in plane (parallel +
    // one point in plane forces the whole line in plane, so check it).
    if (Number.isFinite(prim.tMax) && prim.tMax !== prim.tMin) {
      const far = addScaled(prim.origin, prim.direction, prim.tMax);
      const farDist = dot(far, plane.normal) + plane.constant;
      if (!approximatelyZero(farDist, normalMag * coordinateScale([far]))) {
        return { kind: "parallel", distance: null };
      }
    }
    return { kind: "contained" };
  }
  // t = n·(P0−P)/(n·d).
  const planePoint = pointOnPlane(plane);
  const t = dot(plane.normal, subtract(planePoint, prim.origin)) / denom;
  if (!Number.isFinite(t)) {
    return null;
  }
  if (!withinInterval(t, prim.tMin, prim.tMax)) {
    return { kind: "outside-domain", parameter: t };
  }
  const clampedT = clampToInterval(t, prim.tMin, prim.tMax);
  return { kind: "point", point: addScaled(prim.origin, prim.direction, clampedT), parameter: clampedT };
}

/** Any finite point satisfying n·x + c = 0 (closest-to-origin point). */
export function pointOnPlane(plane: ResolvedPlane3): MathPoint3 {
  const nn = dot(plane.normal, plane.normal);
  const scale = -plane.constant / nn;
  return { x: plane.normal.x * scale, y: plane.normal.y * scale, z: plane.normal.z * scale };
}

/** Line↔plane distance: 0 when intersecting/contained, else point-plane. */
export function distanceLinearPlane(prim: LinearPrimitive3, plane: ResolvedPlane3): number | null {
  const hit = intersectLinearPlane(prim, plane);
  if (!hit) {
    return null;
  }
  if (hit.kind === "point" || hit.kind === "contained") {
    return 0;
  }
  if (hit.kind === "parallel" && hit.distance !== null) {
    return hit.distance;
  }
  if (hit.kind !== "outside-domain") {
    return null;
  }
  // Outside-domain: closest domain point to the plane.
  const t = clampToInterval(hit.parameter, prim.tMin, prim.tMax);
  return distancePointPlane(addScaled(prim.origin, prim.direction, t), plane);
}

// ---------------------------------------------------------------------------
// Plane ↔ plane intersection (PART 18)
// ---------------------------------------------------------------------------

export type PlanePlaneIntersection =
  | { kind: "line"; point: MathPoint3; direction: MathVector3 }
  | { kind: "coincident" }
  | { kind: "parallel"; distance: number | null };

export function intersectPlanes(p1: ResolvedPlane3, p2: ResolvedPlane3): PlanePlaneIntersection | null {
  if (
    !allFinite(p1.normal.x, p1.normal.y, p1.normal.z, p1.constant, p2.normal.x, p2.normal.y, p2.normal.z, p2.constant)
  ) {
    return null;
  }
  const direction = {
    x: p1.normal.y * p2.normal.z - p1.normal.z * p2.normal.y,
    y: p1.normal.z * p2.normal.x - p1.normal.x * p2.normal.z,
    z: p1.normal.x * p2.normal.y - p1.normal.y * p2.normal.x
  };
  if (vectorsParallel(p1.normal, p2.normal) || isZeroVec3(direction)) {
    // Coincident iff a point of p1 lies in p2 (resolved math, never raw
    // strings — scaled/rearranged equivalents classify coincident).
    const anchor = pointOnPlane(p1);
    if (!allFinite(anchor.x, anchor.y, anchor.z)) {
      return null;
    }
    const residual = dot(anchor, p2.normal) + p2.constant;
    const scale = coordinateScale([anchor]) * magnitude(p2.normal);
    if (approximatelyZero(residual, scale)) {
      return { kind: "coincident" };
    }
    const distance = Math.abs(residual) / magnitude(p2.normal);
    return { kind: "parallel", distance: Number.isFinite(distance) ? distance : null };
  }
  // Stable point: eliminate the axis of the largest |d| component
  // (established analytic construction, no matrix inversion).
  const ax = Math.abs(direction.x);
  const ay = Math.abs(direction.y);
  const az = Math.abs(direction.z);
  let point: MathPoint3 | null = null;
  if (ax >= ay && ax >= az) {
    point = solvePlanePair(p1.normal.y, p1.normal.z, p1.constant, p2.normal.y, p2.normal.z, p2.constant, "x");
  } else if (ay >= ax && ay >= az) {
    point = solvePlanePair(p1.normal.x, p1.normal.z, p1.constant, p2.normal.x, p2.normal.z, p2.constant, "y");
  } else {
    point = solvePlanePair(p1.normal.x, p1.normal.y, p1.constant, p2.normal.x, p2.normal.y, p2.constant, "z");
  }
  if (!point) {
    return null;
  }
  return { kind: "line", point, direction };
}

/** Solve the 2×2 remainder after fixing the eliminated axis to 0. */
function solvePlanePair(
  a1: number, b1: number, c1: number,
  a2: number, b2: number, c2: number,
  eliminated: "x" | "y" | "z"
): MathPoint3 | null {
  // By Cramer's rule this determinant IS the eliminated axis component of
  // n1×n2; elimination always picks the largest |component|, and
  // near-parallel planes never reach here (vectorsParallel gate above),
  // so det is robustly nonzero — the exact-zero check is a guard only.
  const det = a1 * b2 - a2 * b1;
  if (det === 0 || !Number.isFinite(det)) {
    return null;
  }
  const u = (b1 * c2 - b2 * c1) / det;
  const v = (a2 * c1 - a1 * c2) / det;
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    return null;
  }
  if (eliminated === "x") {
    return { x: 0, y: u, z: v };
  }
  if (eliminated === "y") {
    return { x: u, y: 0, z: v };
  }
  return { x: u, y: v, z: 0 };
}

/** Plane↔plane distance: 0 unless parallel (then point-plane). */
export function distancePlanePlane(p1: ResolvedPlane3, p2: ResolvedPlane3): number | null {
  const hit = intersectPlanes(p1, p2);
  if (!hit) {
    return null;
  }
  if (hit.kind === "line" || hit.kind === "coincident") {
    return 0;
  }
  if (hit.distance !== null) {
    return hit.distance;
  }
  return distancePointPlane(pointOnPlane(p1), p2);
}

// ---------------------------------------------------------------------------
// Linear ↔ linear relation engine (PART 16-17)
// ---------------------------------------------------------------------------

export type LinearRelation =
  | { kind: "intersect"; point: MathPoint3; parameterA: number; parameterB: number; distance: number }
  | {
      kind: "overlap";
      start: MathPoint3 | null;
      end: MathPoint3 | null;
      direction: MathVector3 | null;
      bounded: "segment" | "ray";
    }
  | { kind: "coincident" }
  | {
      kind: "parallel-disjoint";
      pointA: MathPoint3;
      pointB: MathPoint3;
      parameterA: number;
      parameterB: number;
      distance: number;
    }
  | {
      kind: "skew";
      pointA: MathPoint3;
      pointB: MathPoint3;
      parameterA: number;
      parameterB: number;
      distance: number;
    }
  | {
      kind: "disjoint";
      pointA: MathPoint3;
      pointB: MathPoint3;
      parameterA: number;
      parameterB: number;
      distance: number;
    };

interface ClosestPair {
  s: number;
  t: number;
  pointA: MathPoint3;
  pointB: MathPoint3;
  distance: number;
}

function finiteBounds(prim: LinearPrimitive3): Array<{ value: number; isMin: boolean }> {
  const bounds: Array<{ value: number; isMin: boolean }> = [];
  if (Number.isFinite(prim.tMin)) {
    bounds.push({ value: prim.tMin, isMin: true });
  }
  if (Number.isFinite(prim.tMax)) {
    bounds.push({ value: prim.tMax, isMin: false });
  }
  return bounds;
}

/**
 * Exact bounded closest points between two non-degenerate linear
 * primitives. Interior critical point when feasible, else exact minima
 * over every finite-boundary edge.
 */
function closestBetweenLinears(a: LinearPrimitive3, b: LinearPrimitive3): ClosestPair | null {
  const u = a.direction;
  const v = b.direction;
  const w0 = subtract(a.origin, b.origin);
  if (!allFinite(u.x, u.y, u.z, v.x, v.y, v.z, w0.x, w0.y, w0.z)) {
    return null;
  }
  const aa = dot(u, u);
  const bb = dot(u, v);
  const cc = dot(v, v);
  const d = dot(u, w0);
  const e = dot(v, w0);
  const denom = aa * cc - bb * bb;
  if (!(denom > 0) || !Number.isFinite(denom)) {
    return null;
  }
  const candidates: ClosestPair[] = [];
  const consider = (s: number, t: number): void => {
    if (!Number.isFinite(s) || !Number.isFinite(t)) {
      return;
    }
    const pointA = addScaled(a.origin, u, s);
    const pointB = addScaled(b.origin, v, t);
    const distance = magnitude(subtract(pointA, pointB));
    if (Number.isFinite(distance)) {
      candidates.push({ s, t, pointA, pointB, distance });
    }
  };
  // Interior critical point (always feasible for line-line).
  const sStar = (bb * e - cc * d) / denom;
  const tStar = (aa * e - bb * d) / denom;
  if (withinInterval(sStar, a.tMin, a.tMax) && withinInterval(tStar, b.tMin, b.tMax)) {
    consider(clampToInterval(sStar, a.tMin, a.tMax), clampToInterval(tStar, b.tMin, b.tMax));
  }
  // Edge s = sb (finite A bounds): optimal t(sb) = (sb·b − e)/c.
  for (const bound of finiteBounds(a)) {
    const tEdge = (bound.value * bb - e) / cc;
    consider(bound.value, clampToInterval(tEdge, b.tMin, b.tMax));
  }
  // Edge t = tb (finite B bounds): optimal s(tb) = (tb·b − d)/a.
  for (const bound of finiteBounds(b)) {
    const sEdge = (bound.value * bb - d) / aa;
    consider(clampToInterval(sEdge, a.tMin, a.tMax), bound.value);
  }
  if (candidates.length === 0) {
    return null;
  }
  let best = candidates[0] as ClosestPair;
  for (const candidate of candidates) {
    if (candidate.distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

/** Closest point on B (any bounds) to a fixed query point. */
function closestOnLinearToPoint(prim: LinearPrimitive3, query: MathPoint3): { point: MathPoint3; parameter: number } | null {
  const projected = projectPointToLinearPrimitive(query, prim);
  if (!projected) {
    return null;
  }
  const t = clampToInterval(projected.parameter, prim.tMin, prim.tMax);
  return { point: addScaled(prim.origin, prim.direction, t), parameter: t };
}

function zeroDistance(distance: number, points: MathPoint3[]): boolean {
  return approximatelyZero(distance, coordinateScale(points));
}

export function relateLinearPrimitives(a: LinearPrimitive3, b: LinearPrimitive3): LinearRelation | null {
  if (
    !allFinite(a.origin.x, a.origin.y, a.origin.z, b.origin.x, b.origin.y, b.origin.z) ||
    isZeroVec3(a.direction) ||
    isZeroVec3(b.direction)
  ) {
    return null;
  }
  if (vectorsParallel(a.direction, b.direction)) {
    return relateParallelLinears(a, b);
  }
  const closest = closestBetweenLinears(a, b);
  if (!closest) {
    return null;
  }
  const points = [a.origin, b.origin, closest.pointA, closest.pointB];
  if (zeroDistance(closest.distance, points)) {
    const midpoint = {
      x: (closest.pointA.x + closest.pointB.x) / 2,
      y: (closest.pointA.y + closest.pointB.y) / 2,
      z: (closest.pointA.z + closest.pointB.z) / 2
    };
    return { kind: "intersect", point: midpoint, parameterA: closest.s, parameterB: closest.t, distance: 0 };
  }
  // Nonparallel infinite lines with positive distance: skew. Bounded
  // pairs are disjoint (never labeled skew, PART 16).
  if (linearIsInfinite(a) && linearIsInfinite(b)) {
    return {
      kind: "skew",
      pointA: closest.pointA,
      pointB: closest.pointB,
      parameterA: closest.s,
      parameterB: closest.t,
      distance: closest.distance
    };
  }
  return {
    kind: "disjoint",
    pointA: closest.pointA,
    pointB: closest.pointB,
    parameterA: closest.s,
    parameterB: closest.t,
    distance: closest.distance
  };
}

function relateParallelLinears(a: LinearPrimitive3, b: LinearPrimitive3): LinearRelation | null {
  const aa = dot(a.direction, a.direction);
  const separation = subtract(b.origin, a.origin);
  const sepMag = magnitude(separation);
  const aMag = Math.sqrt(aa);
  const originScale = coordinateScale([a.origin, b.origin]);
  if (!Number.isFinite(sepMag) || !Number.isFinite(aMag) || aMag === 0) {
    return null;
  }
  // Collinear iff the origin offset is parallel to the direction
  // (coincident origins count as collinear).
  const collinear =
    approximatelyZero(sepMag, originScale) || vectorsParallel(separation, a.direction);
  if (!collinear) {
    // Parallel-disjoint: exact projection of B's origin onto A's axis,
    // clamped to A's domain, then closest on B (exact for parallel sets).
    const sRaw = dot(separation, a.direction) / aa;
    const s = clampToInterval(sRaw, a.tMin, a.tMax);
    const pointA = addScaled(a.origin, a.direction, s);
    const onB = closestOnLinearToPoint(b, pointA);
    if (!onB) {
      return null;
    }
    return {
      kind: "parallel-disjoint",
      pointA,
      pointB: onB.point,
      parameterA: s,
      parameterB: onB.parameter,
      distance: magnitude(subtract(pointA, onB.point))
    };
  }
  // Collinear: intersect the parameter intervals on A's s-axis.
  // s(t) = s0 + t·σ maps B's domain onto A's axis.
  const s0 = dot(separation, a.direction) / aa;
  const sigma = dot(b.direction, a.direction) / aa;
  if (!Number.isFinite(s0) || !Number.isFinite(sigma)) {
    return null;
  }
  const mapT = (t: number): number => s0 + t * sigma;
  let lo = Number.NEGATIVE_INFINITY;
  let hi = Number.POSITIVE_INFINITY;
  if (Number.isFinite(b.tMin)) {
    const sAtMin = mapT(b.tMin);
    if (!Number.isFinite(sAtMin)) {
      return null;
    }
    if (sigma >= 0) {
      lo = Math.max(lo, sAtMin);
    } else {
      hi = Math.min(hi, sAtMin);
    }
  }
  if (Number.isFinite(b.tMax)) {
    const sAtMax = mapT(b.tMax);
    if (!Number.isFinite(sAtMax)) {
      return null;
    }
    if (sigma >= 0) {
      hi = Math.min(hi, sAtMax);
    } else {
      lo = Math.max(lo, sAtMax);
    }
  }
  const overlapLo = Math.max(lo, a.tMin);
  const overlapHi = Math.min(hi, a.tMax);
  const tol = intervalTolerance(
    Number.isFinite(overlapLo) ? overlapLo : 0,
    Number.isFinite(overlapHi) ? overlapHi : 0
  );
  if (overlapLo > overlapHi + tol) {
    // Collinear but disjoint: nearest interval ends give exact closest
    // points on these 1D sets ([lo,hi] is B's range on A's s-axis).
    return parallelDisjointFromIntervals(a, b, lo, hi);
  }
  // S27-R4 BLOCKER fix: the touch test below is only valid for FINITE
  // ends. Unbounded overlaps must fall through to coincident/overlap-ray
  // handling — comparing ±Inf here previously collapsed every unbounded
  // collinear overlap into a spurious point or null.
  if (Number.isFinite(overlapLo) && Number.isFinite(overlapHi)) {
    if (approximatelyEqual(overlapLo, overlapHi, Math.max(1, Math.abs(overlapLo), Math.abs(overlapHi)))) {
      const point = addScaled(a.origin, a.direction, overlapLo);
      return {
        kind: "intersect",
        point,
        parameterA: overlapLo,
        parameterB: parameterBForS(b, overlapLo, s0, sigma),
        distance: 0
      };
    }
    return {
      kind: "overlap",
      start: addScaled(a.origin, a.direction, overlapLo),
      end: addScaled(a.origin, a.direction, overlapHi),
      direction: null,
      bounded: "segment"
    };
  }
  if (overlapLo === Number.NEGATIVE_INFINITY && overlapHi === Number.POSITIVE_INFINITY) {
    return { kind: "coincident" };
  }
  // Ray overlap: exactly one finite end plus the shared direction.
  const finiteEnd = Number.isFinite(overlapLo) ? overlapLo : overlapHi;
  const end = addScaled(a.origin, a.direction, finiteEnd as number);
  const unboundedTowardMinus = !Number.isFinite(overlapLo);
  const direction = unboundedTowardMinus
    ? { x: -a.direction.x, y: -a.direction.y, z: -a.direction.z }
    : { ...a.direction };
  return {
    kind: "overlap",
    start: unboundedTowardMinus ? null : end,
    end: unboundedTowardMinus ? end : null,
    direction,
    bounded: "ray"
  };
}

/** Recover B's parameter for a point at A's s-coordinate (collinear sets). */
function parameterBForS(b: LinearPrimitive3, s: number, s0: number, sigma: number): number {
  if (sigma === 0) {
    return clampToInterval(b.tMin, b.tMin, b.tMax);
  }
  const t = (s - s0) / sigma;
  if (!Number.isFinite(t)) {
    return clampToInterval(b.tMin, b.tMin, b.tMax);
  }
  return clampToInterval(t, b.tMin, b.tMax);
}

/** Collinear-disjoint closest pair from interval order on A's axis. */
function parallelDisjointFromIntervals(
  a: LinearPrimitive3,
  b: LinearPrimitive3,
  bLo: number,
  bHi: number
): LinearRelation | null {
  // Nearest end of A's domain to B's s-range: B below A's domain floor
  // uses tMin, B above A's domain ceiling uses tMax. (A line always
  // overlaps collinear B, so sA is finite here by construction.)
  let sA: number;
  if (bHi <= a.tMin) {
    sA = a.tMin;
  } else if (bLo >= a.tMax) {
    sA = a.tMax;
  } else {
    return null;
  }
  if (!Number.isFinite(sA)) {
    return null;
  }
  const pointA = addScaled(a.origin, a.direction, sA);
  const onB = closestOnLinearToPoint(b, pointA);
  if (!onB) {
    return null;
  }
  // Refine symmetrically: closest on A to B's point (exact on 1D sets).
  const sRefined = clampToInterval(dot(subtract(onB.point, a.origin), a.direction) / dot(a.direction, a.direction), a.tMin, a.tMax);
  if (!Number.isFinite(sRefined)) {
    return null;
  }
  const refinedA = addScaled(a.origin, a.direction, sRefined);
  return {
    kind: "parallel-disjoint",
    pointA: refinedA,
    pointB: onB.point,
    parameterA: sRefined,
    parameterB: onB.parameter,
    distance: magnitude(subtract(refinedA, onB.point))
  };
}

/** Linear↔linear distance: 0 on intersect/overlap/coincident. */
export function distanceLinearLinear(a: LinearPrimitive3, b: LinearPrimitive3): number | null {
  const relation = relateLinearPrimitives(a, b);
  if (!relation) {
    return null;
  }
  if (relation.kind === "intersect" || relation.kind === "overlap" || relation.kind === "coincident") {
    return 0;
  }
  return relation.distance;
}

// ---------------------------------------------------------------------------
// Degenerate-operand reduction (PART 16): point-like segments reduce to
// point queries so every Line/Ray/Segment combination — including
// degenerate inputs — classifies without NaN. Point-side parameters
// report 0 by convention (documented; a point has no axis).
// ---------------------------------------------------------------------------

export type LinearOperand =
  | { kind: "line"; line: Line3 }
  | { kind: "ray"; ray: Ray3 }
  | { kind: "segment"; segment: Segment3 };

function operandToPrimitive(operand: LinearOperand): LinearPrimitive3 | null {
  if (operand.kind === "line") {
    return linearFromLine(operand.line);
  }
  if (operand.kind === "ray") {
    return linearFromRay(operand.ray);
  }
  return linearFromSegment(operand.segment);
}

function operandPoint(operand: LinearOperand): MathPoint3 | null {
  if (operand.kind === "segment") {
    const direction = subtract(operand.segment.end, operand.segment.start);
    if (isZeroVec3(direction)) {
      return { ...operand.segment.start };
    }
  }
  return null;
}

export function relateLinearObjects(a: LinearOperand, b: LinearOperand): LinearRelation | null {
  const primA = operandToPrimitive(a);
  const primB = operandToPrimitive(b);
  if (primA && primB) {
    return relateLinearPrimitives(primA, primB);
  }
  const pointA = operandPoint(a);
  const pointB = operandPoint(b);
  if (pointA && pointB) {
    const distance = distancePointPoint(pointA, pointB);
    if (distance === null) {
      return null;
    }
    if (zeroDistance(distance, [pointA, pointB])) {
      const midpoint = {
        x: (pointA.x + pointB.x) / 2,
        y: (pointA.y + pointB.y) / 2,
        z: (pointA.z + pointB.z) / 2
      };
      return { kind: "intersect", point: midpoint, parameterA: 0, parameterB: 0, distance: 0 };
    }
    return {
      kind: "disjoint",
      pointA: { ...pointA },
      pointB: { ...pointB },
      parameterA: 0,
      parameterB: 0,
      distance
    };
  }
  // Exactly one side is point-like: closest point on the live primitive.
  const livePrim = primA ?? primB;
  const query = primA ? pointB : pointA;
  const liveIsA = primA !== null;
  if (!livePrim || !query) {
    return null;
  }
  const projected = projectPointToLinearPrimitive(query, livePrim);
  if (!projected) {
    return null;
  }
  const clampedT = clampToInterval(projected.parameter, livePrim.tMin, livePrim.tMax);
  if (zeroDistance(projected.distance, [query, projected.point])) {
    return {
      kind: "intersect",
      point: projected.point,
      parameterA: liveIsA ? clampedT : 0,
      parameterB: liveIsA ? 0 : clampedT,
      distance: 0
    };
  }
  return {
    kind: "disjoint",
    pointA: liveIsA ? projected.point : { ...query },
    pointB: liveIsA ? { ...query } : projected.point,
    parameterA: liveIsA ? clampedT : 0,
    parameterB: liveIsA ? 0 : clampedT,
    distance: projected.distance
  };
}

/** Segment↔plane with degenerate (point-like) reduction. */
export function intersectSegmentPlane(
  segment: Segment3,
  plane: ResolvedPlane3
): LinearPlaneIntersection | null {
  const direction = subtract(segment.end, segment.start);
  if (!isZeroVec3(direction)) {
    const prim = linearFromSegment(segment);
    return prim ? intersectLinearPlane(prim, plane) : null;
  }
  // Point-like convention (PART 15): on-plane reads contained, off-plane
  // reads parallel-disjoint with point-plane distance.
  if (!allFinite(segment.start.x, segment.start.y, segment.start.z)) {
    return null;
  }
  const distance = distancePointPlane(segment.start, plane);
  if (distance === null) {
    return null;
  }
  if (zeroDistance(distance, [segment.start])) {
    return { kind: "contained" };
  }
  return { kind: "parallel", distance };
}
