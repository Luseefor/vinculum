// S27 geometry-analysis facts: the single pure bridge from canonical
// scene objects to relation results, shared by the Inspector section and
// the derived-overlay updater so numbers and pictures can never disagree.
// Synchronous, Three-free, math coordinates only, zero workers. Facts are
// recomputed from LIVE sources on every use — never cached, never stored.

import type { GraphObject } from "@vinculum/scene/types";
import {
  resolveLineGeometry,
  resolvePlaneGeometry,
  resolvePointGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry,
  type ResolvedAnchoredVector,
  type ResolvedPlane3
} from "./geometryResolve";
import {
  angleBetweenLines,
  angleBetweenVectors,
  angleLinePlane,
  anglePlanePlane,
  distanceLinearLinear,
  distanceLinearPlane,
  distancePlanePlane,
  distancePointPlane,
  distancePointPoint,
  intersectLinearPlane,
  intersectPlanes,
  intersectSegmentPlane,
  linearFromLine,
  linearFromRay,
  linearFromSegment,
  projectPointToLine,
  projectPointToPlane,
  projectPointToRay,
  projectPointToSegment,
  relateLinearObjects,
  type LinearOperand,
  type LinearPlaneIntersection,
  type LinearPrimitive3,
  type LinearRelation,
  type MathPoint3,
  type MathVector3,
  type PlanePlaneIntersection,
  type PointPlaneProjection,
  type PointProjection
} from "./geometryRelations";
import { vectorsParallel, vectorsPerpendicular } from "./geometryTolerance";

export type GeometrySourceKind = "point" | "vector" | "line" | "ray" | "segment" | "plane";

export type ResolvedGeometrySource =
  | { kind: "point"; point: MathPoint3 }
  | { kind: "vector"; anchored: ResolvedAnchoredVector }
  | { kind: "line"; line: { point: MathPoint3; direction: MathVector3 } }
  | { kind: "ray"; ray: { origin: MathPoint3; direction: MathVector3 } }
  | { kind: "segment"; segment: { start: MathPoint3; end: MathPoint3 } }
  | { kind: "plane"; plane: ResolvedPlane3 }
  | { kind: "unresolved"; reason: string }
  | { kind: "unsupported" };

/** Resolve a canonical scene object for relation math (explicit params). */
export function resolveGeometrySource(
  object: GraphObject,
  params: Record<string, number>
): ResolvedGeometrySource {
  switch (object.kind) {
    case "point": {
      const resolved = resolvePointGeometry([object.xExpr, object.yExpr, object.zExpr], params);
      return resolved.status === "ok"
        ? { kind: "point", point: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    case "vector": {
      const resolved = resolveVectorGeometry(
        [object.oxExpr, object.oyExpr, object.ozExpr],
        [object.vxExpr, object.vyExpr, object.vzExpr],
        params
      );
      return resolved.status === "ok"
        ? { kind: "vector", anchored: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    case "line": {
      const resolved = resolveLineGeometry(
        [object.pxExpr, object.pyExpr, object.pzExpr],
        [object.dxExpr, object.dyExpr, object.dzExpr],
        params
      );
      return resolved.status === "ok"
        ? { kind: "line", line: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    case "ray": {
      const resolved = resolveRayGeometry(
        [object.oxExpr, object.oyExpr, object.ozExpr],
        [object.dxExpr, object.dyExpr, object.dzExpr],
        params
      );
      return resolved.status === "ok"
        ? { kind: "ray", ray: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    case "segment": {
      const resolved = resolveSegmentGeometry(
        [object.axExpr, object.ayExpr, object.azExpr],
        [object.bxExpr, object.byExpr, object.bzExpr],
        params
      );
      return resolved.status === "ok"
        ? { kind: "segment", segment: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    case "plane": {
      const resolved = resolvePlaneGeometry(object.equation, params);
      return resolved.status === "ok"
        ? { kind: "plane", plane: resolved.value }
        : { kind: "unresolved", reason: resolved.reason };
    }
    default:
      // Non-geometric scene kinds (surfaces, curves, fields): pair-level
      // incompatible, distinct from unresolvable geometry (PART 49 keeps
      // both states precise).
      return { kind: "unsupported" };
  }
}

function isLinearSource(
  source: ResolvedGeometrySource
): source is Extract<ResolvedGeometrySource, { kind: "line" | "ray" | "segment" }> {
  return source.kind === "line" || source.kind === "ray" || source.kind === "segment";
}

function linearOperandOf(source: Extract<ResolvedGeometrySource, { kind: "line" | "ray" | "segment" }>): LinearOperand {
  if (source.kind === "line") {
    return { kind: "line", line: source.line };
  }
  if (source.kind === "ray") {
    return { kind: "ray", ray: source.ray };
  }
  return { kind: "segment", segment: source.segment };
}

function linearPrimitiveOf(
  source: Extract<ResolvedGeometrySource, { kind: "line" | "ray" | "segment" }>
): LinearPrimitive3 | null {
  if (source.kind === "line") {
    return linearFromLine(source.line);
  }
  if (source.kind === "ray") {
    return linearFromRay(source.ray);
  }
  return linearFromSegment(source.segment);
}

function linearDirectionOf(
  source: Extract<ResolvedGeometrySource, { kind: "line" | "ray" | "segment" }>
): MathVector3 | null {
  if (source.kind === "line") {
    return source.line.direction;
  }
  if (source.kind === "ray") {
    return source.ray.direction;
  }
  const direction = {
    x: source.segment.end.x - source.segment.start.x,
    y: source.segment.end.y - source.segment.start.y,
    z: source.segment.end.z - source.segment.start.z
  };
  return direction.x === 0 && direction.y === 0 && direction.z === 0 ? null : direction;
}

export type GeometryAnalysisFacts =
  | { pair: "point-point"; distance: number }
  | { pair: "point-linear"; linearKind: "line" | "ray" | "segment"; projection: PointProjection }
  | { pair: "point-plane"; projection: PointPlaneProjection }
  | {
      pair: "vector-vector";
      angleRadians: number | null;
      parallel: boolean;
      perpendicular: boolean;
    }
  | { pair: "linear-linear"; relation: LinearRelation; angleRadians: number | null }
  | {
      pair: "linear-plane";
      intersection: LinearPlaneIntersection;
      angleRadians: number | null;
      distance: number | null;
    }
  | {
      pair: "plane-plane";
      intersection: PlanePlaneIntersection;
      angleRadians: number | null;
      distance: number | null;
    }
  | { pair: "unresolved"; reason: string }
  | { pair: "incompatible" };

/**
 * Which kinds may pair for analysis. Order-independent; self-pairs only
 * where meaningful (point-point distance, vector-vector angle,
 * linear-linear relations, plane-plane relations).
 */
export function geometryPairSupported(kindA: string, kindB: string): boolean {
  const linear = new Set(["line", "ray", "segment"]);
  if (kindA === kindB) {
    return kindA === "point" || kindA === "vector" || linear.has(kindA) || kindA === "plane";
  }
  const pair = new Set([kindA, kindB]);
  if (linear.has(kindA) && linear.has(kindB)) {
    return true;
  }
  if (pair.has("point") && (linear.has(kindA) || linear.has(kindB) || pair.has("plane"))) {
    return true;
  }
  if ((linear.has(kindA) && pair.has("plane")) || (linear.has(kindB) && pair.has("plane"))) {
    return true;
  }
  return false;
}

/** Compute every cheap fact for a resolved pair (PART 22 preferred UX). */
export function computeGeometryFacts(
  primary: ResolvedGeometrySource,
  secondary: ResolvedGeometrySource
): GeometryAnalysisFacts {
  if (primary.kind === "unsupported" || secondary.kind === "unsupported") {
    return { pair: "incompatible" };
  }
  if (primary.kind === "unresolved") {
    return { pair: "unresolved", reason: primary.reason };
  }
  if (secondary.kind === "unresolved") {
    return { pair: "unresolved", reason: secondary.reason };
  }
  if (primary.kind === "point" && secondary.kind === "point") {
    const distance = distancePointPoint(primary.point, secondary.point);
    return distance === null ? { pair: "unresolved", reason: "Points are non-finite." } : { pair: "point-point", distance };
  }
  const pointSide =
    primary.kind === "point" ? primary : secondary.kind === "point" ? secondary : null;
  if (pointSide) {
    const other = pointSide === primary ? secondary : primary;
    if (isLinearSource(other)) {
      const projection =
        other.kind === "line"
          ? projectPointToLine(pointSide.point, other.line)
          : other.kind === "ray"
            ? projectPointToRay(pointSide.point, other.ray)
            : projectPointToSegment(pointSide.point, other.segment);
      return projection
        ? { pair: "point-linear", linearKind: other.kind, projection }
        : { pair: "unresolved", reason: "Projection unavailable." };
    }
    if (other.kind === "plane") {
      const projection = projectPointToPlane(pointSide.point, other.plane);
      return projection ? { pair: "point-plane", projection } : { pair: "unresolved", reason: "Projection unavailable." };
    }
    return { pair: "incompatible" };
  }
  if (primary.kind === "vector" && secondary.kind === "vector") {
    const a = primary.anchored.vector;
    const b = secondary.anchored.vector;
    return {
      pair: "vector-vector",
      angleRadians: angleBetweenVectors(a, b),
      parallel: vectorsParallel(a, b),
      perpendicular: vectorsPerpendicular(a, b)
    };
  }
  if (isLinearSource(primary) && isLinearSource(secondary)) {
    const relation = relateLinearObjects(linearOperandOf(primary), linearOperandOf(secondary));
    if (!relation) {
      return { pair: "unresolved", reason: "Relation unavailable." };
    }
    const d1 = linearDirectionOf(primary);
    const d2 = linearDirectionOf(secondary);
    return {
      pair: "linear-linear",
      relation,
      angleRadians: d1 && d2 ? angleBetweenLines(d1, d2) : null
    };
  }
  const linearSide = isLinearSource(primary) ? primary : isLinearSource(secondary) ? secondary : null;
  const planeSide =
    primary.kind === "plane" ? primary : secondary.kind === "plane" ? secondary : null;
  if (linearSide && planeSide) {
    const prim = linearPrimitiveOf(linearSide);
    if (!prim && linearSide.kind === "segment") {
      const intersection = intersectSegmentPlane(linearSide.segment, planeSide.plane);
      if (!intersection) {
        return { pair: "unresolved", reason: "Intersection unavailable." };
      }
      const direction = {
        x: linearSide.segment.end.x - linearSide.segment.start.x,
        y: linearSide.segment.end.y - linearSide.segment.start.y,
        z: linearSide.segment.end.z - linearSide.segment.start.z
      };
      return {
        pair: "linear-plane",
        intersection,
        angleRadians: angleLinePlane(direction, planeSide.plane.normal),
        distance:
          intersection.kind === "point" || intersection.kind === "contained"
            ? 0
            : intersection.kind === "parallel"
              ? (intersection.distance ?? null)
              : null
      };
    }
    if (!prim) {
      return { pair: "unresolved", reason: "Intersection unavailable." };
    }
    const intersection = intersectLinearPlane(prim, planeSide.plane);
    if (!intersection) {
      return { pair: "unresolved", reason: "Intersection unavailable." };
    }
    return {
      pair: "linear-plane",
      intersection,
      angleRadians: angleLinePlane(prim.direction, planeSide.plane.normal),
      distance: distanceLinearPlane(prim, planeSide.plane)
    };
  }
  if (primary.kind === "plane" && secondary.kind === "plane") {
    const intersection = intersectPlanes(primary.plane, secondary.plane);
    if (!intersection) {
      return { pair: "unresolved", reason: "Intersection unavailable." };
    }
    return {
      pair: "plane-plane",
      intersection,
      angleRadians: anglePlanePlane(primary.plane.normal, secondary.plane.normal),
      distance: distancePlanePlane(primary.plane, secondary.plane)
    };
  }
  return { pair: "incompatible" };
}

/** Degrees for Inspector display (math core stays radians). */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
