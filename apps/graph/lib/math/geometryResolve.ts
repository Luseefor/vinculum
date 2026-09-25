// S26 pure resolvers: canonical scene coordinate expressions +
// parameter snapshot -> finite mathematical primitive or a structured
// diagnostic. Renderer-independent (no Three.js); the Three builders
// consume these results, and S27 constructions will too.
//
// Degeneracy contract (PART 5-8/49):
// - zero vector v=<0,0,0>: VALID, degenerate, magnitude 0, no direction.
// - zero-direction line/ray: INVALID but editable ("... direction must
//   be nonzero."), renderer shows nothing, no NaN.
// - coincident segment endpoints: VALID point-degenerate segment.

import { compileGeometryCoordinate } from "./compileGeometryCoordinate";
import {
  isFiniteVec3,
  isZeroVec3,
  magnitudeVec3,
  subtractVec3,
  type AnchoredVector3,
  type Line3,
  type Ray3,
  type Segment3
} from "./geometryPrimitives";

export type ResolvedGeometry<T> =
  | { status: "ok"; value: T; degenerate: boolean }
  | { status: "invalid"; reason: string };

type Triple = { x: number; y: number; z: number };

type TripleResult = { status: "ok"; point: Triple } | { status: "invalid"; reason: string };

function resolveTriple(
  exprs: readonly [string, string, string],
  label: string,
  params: Record<string, number>
): TripleResult {
  const values: number[] = [];
  for (const expr of exprs) {
    const compiled = compileGeometryCoordinate(expr, params);
    if (compiled.error) {
      return { status: "invalid", reason: `${label}: ${compiled.error}` };
    }
    const value = compiled.evaluate(params);
    if (!Number.isFinite(value)) {
      return { status: "invalid", reason: `${label}: expression produced a non-finite value.` };
    }
    values.push(value);
  }
  return { status: "ok", point: { x: values[0] as number, y: values[1] as number, z: values[2] as number } };
}

export interface ResolvedAnchoredVector extends AnchoredVector3 {
  magnitude: number;
}

export function resolveVectorGeometry(
  originExprs: readonly [string, string, string],
  componentExprs: readonly [string, string, string],
  params: Record<string, number>
): ResolvedGeometry<ResolvedAnchoredVector> {
  const origin = resolveTriple(originExprs, "Origin", params);
  if (origin.status !== "ok") {
    return { status: "invalid", reason: origin.reason };
  }
  const components = resolveTriple(componentExprs, "Components", params);
  if (components.status !== "ok") {
    return { status: "invalid", reason: components.reason };
  }
  const vector = components.point;
  if (!isFiniteVec3(vector)) {
    return { status: "invalid", reason: "Components: expression produced a non-finite value." };
  }
  // Components are the mathematics; origin is the visual anchor (PART 5).
  // A zero vector is valid with magnitude 0 and no defined direction.
  return {
    status: "ok",
    value: { origin: origin.point, vector, magnitude: magnitudeVec3(vector) },
    degenerate: isZeroVec3(vector)
  };
}

export function resolveLineGeometry(
  pointExprs: readonly [string, string, string],
  directionExprs: readonly [string, string, string],
  params: Record<string, number>
): ResolvedGeometry<Line3> {
  const point = resolveTriple(pointExprs, "Point", params);
  if (point.status !== "ok") {
    return { status: "invalid", reason: point.reason };
  }
  const direction = resolveTriple(directionExprs, "Direction", params);
  if (direction.status !== "ok") {
    return { status: "invalid", reason: direction.reason };
  }
  if (isZeroVec3(direction.point)) {
    return { status: "invalid", reason: "Line direction must be nonzero." };
  }
  return { status: "ok", value: { point: point.point, direction: direction.point }, degenerate: false };
}

export function resolveRayGeometry(
  originExprs: readonly [string, string, string],
  directionExprs: readonly [string, string, string],
  params: Record<string, number>
): ResolvedGeometry<Ray3> {
  const origin = resolveTriple(originExprs, "Origin", params);
  if (origin.status !== "ok") {
    return { status: "invalid", reason: origin.reason };
  }
  const direction = resolveTriple(directionExprs, "Direction", params);
  if (direction.status !== "ok") {
    return { status: "invalid", reason: direction.reason };
  }
  if (isZeroVec3(direction.point)) {
    return { status: "invalid", reason: "Ray direction must be nonzero." };
  }
  return { status: "ok", value: { origin: origin.point, direction: direction.point }, degenerate: false };
}

export function resolveSegmentGeometry(
  startExprs: readonly [string, string, string],
  endExprs: readonly [string, string, string],
  params: Record<string, number>
): ResolvedGeometry<Segment3> {
  const start = resolveTriple(startExprs, "Start", params);
  if (start.status !== "ok") {
    return { status: "invalid", reason: start.reason };
  }
  const end = resolveTriple(endExprs, "End", params);
  if (end.status !== "ok") {
    return { status: "invalid", reason: end.reason };
  }
  // One shared degeneracy predicate with the clip kernel (PART 35):
  // coincident means zero displacement under the squared-magnitude
  // epsilon, so resolve and clip agree on near-coincident endpoints.
  const degenerate = isZeroVec3(subtractVec3(end.point, start.point));
  return { status: "ok", value: { start: start.point, end: end.point }, degenerate };
}
