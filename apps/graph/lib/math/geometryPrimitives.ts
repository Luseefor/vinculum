// S26 pure geometry kernel: renderer-independent 3D primitives.
// No Three.js, no React, no stores, no DOM. S27 (intersections,
// projections, distances, angles) consumes this API directly.
//
// Vec3 representation reuses the canonical coordinates module types
// (MathPoint3 for positions, MathVector3 for directions) so no second
// vector convention fights the Plane/sampler implementation.

import type { MathPoint3, MathVector3 } from "./coordinates";

export interface Line3 {
  point: MathPoint3;
  direction: MathVector3;
}

export interface Ray3 {
  origin: MathPoint3;
  direction: MathVector3;
}

export interface Segment3 {
  start: MathPoint3;
  end: MathPoint3;
}

export interface AnchoredVector3 {
  origin: MathPoint3;
  vector: MathVector3;
}

export interface AxisAlignedBox3 {
  min: MathPoint3;
  max: MathPoint3;
}

// Geometric epsilon policy (PART 35): squared-magnitude threshold for
// zero/degeneracy detection only — never a distance tolerance. The value
// 1e-24 (= (1e-12)^2) treats magnitudes below 1e-12 as zero regardless of
// scene scale; S27 owns any scale-aware relation tolerances.
export const GEOMETRY_ZERO_MAGNITUDE_SQUARED = 1e-24;

export function isFiniteVec3(value: MathPoint3 | MathVector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

export function addVec3(a: MathVector3, b: MathVector3): MathVector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVec3(a: MathPoint3 | MathVector3, b: MathPoint3 | MathVector3): MathVector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(v: MathVector3, s: number): MathVector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dotVec3(a: MathVector3, b: MathVector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec3(a: MathVector3, b: MathVector3): MathVector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

export function magnitudeSquaredVec3(v: MathVector3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function magnitudeVec3(v: MathVector3): number {
  return Math.sqrt(magnitudeSquaredVec3(v));
}

// Approximately-zero test for directions/degeneracy (PART 35). Uses the
// squared-magnitude epsilon; never NaN (non-finite inputs are not zero).
export function isZeroVec3(v: MathVector3): boolean {
  const squared = magnitudeSquaredVec3(v);
  return Number.isFinite(squared) && squared <= GEOMETRY_ZERO_MAGNITUDE_SQUARED;
}

// Safe normalization: null for zero/non-finite vectors, never NaN. Line
// and ray builders depend on this instead of blind division.
export function normalizeVec3(v: MathVector3): MathVector3 | null {
  const squared = magnitudeSquaredVec3(v);
  if (!Number.isFinite(squared) || squared <= GEOMETRY_ZERO_MAGNITUDE_SQUARED) {
    return null;
  }
  const magnitude = Math.sqrt(squared);
  return { x: v.x / magnitude, y: v.y / magnitude, z: v.z / magnitude };
}

export function distanceSquaredVec3(a: MathPoint3, b: MathPoint3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function distanceVec3(a: MathPoint3, b: MathPoint3): number {
  return Math.sqrt(distanceSquaredVec3(a, b));
}

export function lerpPoint3(a: MathPoint3, b: MathPoint3, t: number): MathPoint3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

// Parametric evaluation (PART 9). Line accepts all finite t. Ray accepts
// t >= 0 only (negative t is outside ray semantics -> null, never clamped).
// Segment accepts t in [0, 1] (-> null outside, never silently clamped).
export function pointOnLine(line: Line3, t: number): MathPoint3 | null {
  if (!Number.isFinite(t)) {
    return null;
  }
  const x = line.point.x + line.direction.x * t;
  const y = line.point.y + line.direction.y * t;
  const z = line.point.z + line.direction.z * t;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return { x, y, z };
}

export function pointOnRay(ray: Ray3, t: number): MathPoint3 | null {
  if (!Number.isFinite(t) || t < 0) {
    return null;
  }
  return pointOnLine({ point: ray.origin, direction: ray.direction }, t);
}

export function pointOnSegment(segment: Segment3, t: number): MathPoint3 | null {
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    return null;
  }
  return lerpPoint3(segment.start, segment.end, t);
}

function isValidBox(box: AxisAlignedBox3): boolean {
  return (
    isFiniteVec3(box.min) &&
    isFiniteVec3(box.max) &&
    box.min.x <= box.max.x &&
    box.min.y <= box.max.y &&
    box.min.z <= box.max.z
  );
}

interface Interval {
  tEnter: number;
  tExit: number;
}

// Robust slab clipping of P + t*d against one axis slab. Parallel-to-slab
// rays (d = 0 component) intersect only when the origin sits inside the
// slab; no division by zero (PART 15).
function clipSlab(origin: number, direction: number, min: number, max: number, interval: Interval): boolean {
  if (direction === 0) {
    return origin >= min && origin <= max;
  }
  let t0 = (min - origin) / direction;
  let t1 = (max - origin) / direction;
  if (t0 > t1) {
    const swap = t0;
    t0 = t1;
    t1 = swap;
  }
  if (t0 > interval.tEnter) {
    interval.tEnter = t0;
  }
  if (t1 < interval.tExit) {
    interval.tExit = t1;
  }
  return interval.tEnter <= interval.tExit;
}

function clipParametricToBox(
  origin: MathPoint3,
  direction: MathVector3,
  box: AxisAlignedBox3,
  tEnter: number,
  tExit: number
): { entry: MathPoint3; exit: MathPoint3 } | null {
  if (!isValidBox(box) || !isFiniteVec3(origin) || !isFiniteVec3(direction)) {
    return null;
  }
  const interval: Interval = { tEnter, tExit };
  if (!clipSlab(origin.x, direction.x, box.min.x, box.max.x, interval)) {
    return null;
  }
  if (!clipSlab(origin.y, direction.y, box.min.y, box.max.y, interval)) {
    return null;
  }
  if (!clipSlab(origin.z, direction.z, box.min.z, box.max.z, interval)) {
    return null;
  }
  const entry = pointOnLine({ point: origin, direction }, interval.tEnter);
  const exit = pointOnLine({ point: origin, direction }, interval.tExit);
  if (!entry || !exit) {
    return null;
  }
  return { entry, exit };
}

// AABB display clipping for renderer-owned finite views of infinite
// primitives (PART 15). Zero directions yield null (degenerate -> the
// caller renders a marker or nothing, never NaN geometry).
export function clipLineToAabb(line: Line3, box: AxisAlignedBox3): { entry: MathPoint3; exit: MathPoint3 } | null {
  if (isZeroVec3(line.direction)) {
    return null;
  }
  return clipParametricToBox(line.point, line.direction, box, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
}

export function clipRayToAabb(ray: Ray3, box: AxisAlignedBox3): { entry: MathPoint3; exit: MathPoint3 } | null {
  if (isZeroVec3(ray.direction)) {
    return null;
  }
  return clipParametricToBox(ray.origin, ray.direction, box, 0, Number.POSITIVE_INFINITY);
}

export function clipSegmentToAabb(
  segment: Segment3,
  box: AxisAlignedBox3
): { entry: MathPoint3; exit: MathPoint3 } | null {
  const direction = subtractVec3(segment.end, segment.start);
  if (!isFiniteVec3(direction)) {
    return null;
  }
  if (isZeroVec3(direction)) {
    // Coincident endpoints: a valid point-degenerate segment. Visible iff
    // the point sits inside the box.
    if (!isValidBox(box) || !isFiniteVec3(segment.start)) {
      return null;
    }
    const inside =
      segment.start.x >= box.min.x &&
      segment.start.x <= box.max.x &&
      segment.start.y >= box.min.y &&
      segment.start.y <= box.max.y &&
      segment.start.z >= box.min.z &&
      segment.start.z <= box.max.z;
    return inside ? { entry: { ...segment.start }, exit: { ...segment.end } } : null;
  }
  return clipParametricToBox(segment.start, direction, box, 0, 1);
}
