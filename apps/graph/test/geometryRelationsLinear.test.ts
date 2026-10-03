import { describe, expect, it } from "vitest";
import {
  distancePointPoint,
  intersectLinearPlane,
  linearFromLine,
  linearFromRay,
  linearFromSegment,
  projectPointToLine,
  projectPointToRay,
  projectPointToSegment,
  relateLinearObjects,
  relateLinearPrimitives,
  type LinearPrimitive3
} from "@/lib/math/geometryRelations";
import {
  approximatelyEqual,
  approximatelyZero,
  coordinateScale,
  vectorsParallel,
  vectorsPerpendicular
} from "@/lib/math/geometryTolerance";

function line(origin: [number, number, number], direction: [number, number, number]): LinearPrimitive3 {
  const prim = linearFromLine({
    point: { x: origin[0], y: origin[1], z: origin[2] },
    direction: { x: direction[0], y: direction[1], z: direction[2] }
  });
  if (!prim) {
    throw new Error("bad test line");
  }
  return prim;
}

function ray(origin: [number, number, number], direction: [number, number, number]): LinearPrimitive3 {
  const prim = linearFromRay({
    origin: { x: origin[0], y: origin[1], z: origin[2] },
    direction: { x: direction[0], y: direction[1], z: direction[2] }
  });
  if (!prim) {
    throw new Error("bad test ray");
  }
  return prim;
}

function segment(a: [number, number, number], b: [number, number, number]): LinearPrimitive3 {
  const prim = linearFromSegment({
    start: { x: a[0], y: a[1], z: a[2] },
    end: { x: b[0], y: b[1], z: b[2] }
  });
  if (!prim) {
    throw new Error("bad test segment");
  }
  return prim;
}

describe("tolerance policy (S27 PART 4/39)", () => {
  it("classifies ordinary, small, and large scales coherently", () => {
    for (const scale of [1e-6, 1, 1e6]) {
      const u = { x: scale, y: 0, z: 0 };
      const v = { x: 0, y: scale, z: 0 };
      expect(vectorsPerpendicular(u, v)).toBe(true);
      expect(vectorsParallel(u, v)).toBe(false);
      expect(vectorsParallel(u, { x: scale, y: 0, z: 0 })).toBe(true);
    }
  });

  it("separates near-parallel from parallel at ~1e-9 rad", () => {
    const u = { x: 1, y: 0, z: 0 };
    // 1e-7 rad apart: ordinary small-angle geometry, NOT parallel.
    expect(vectorsParallel(u, { x: 1, y: 1e-7, z: 0 })).toBe(false);
    // 1e-12 rad apart: within tolerance, parallel.
    expect(vectorsParallel(u, { x: 1, y: 1e-12, z: 0 })).toBe(true);
    expect(approximatelyZero(1e-13, 1)).toBe(true);
    expect(approximatelyZero(1e-7, 1)).toBe(false);
    expect(approximatelyEqual(1, 1 + 1e-12, 1)).toBe(true);
    expect(coordinateScale([{ x: 1e6, y: -2, z: 3 }])).toBe(1e6);
  });
});

describe("point projections (S27 PART 5-8/35)", () => {
  it("distances A=(1,2,3) B=(4,6,3) as 5", () => {
    expect(distancePointPoint({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 3 })).toBe(5);
    expect(distancePointPoint({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0);
  });

  it("projects (3,4,0) onto the x-axis line as (3,0,0), t=1.5, d=4", () => {
    const projected = projectPointToLine(
      { x: 3, y: 4, z: 0 },
      { point: { x: 0, y: 0, z: 0 }, direction: { x: 2, y: 0, z: 0 } }
    );
    expect(projected?.point).toEqual({ x: 3, y: 0, z: 0 });
    expect(projected?.parameter).toBeCloseTo(1.5, 12);
    expect(projected?.distance).toBe(4);
  });

  it("is invariant under d, 2d, -3d direction scaling", () => {
    const query = { x: 3, y: 4, z: 0 };
    const base = { point: { x: 0, y: 0, z: 0 } };
    const p1 = projectPointToLine(query, { ...base, direction: { x: 1, y: 0, z: 0 } });
    const p2 = projectPointToLine(query, { ...base, direction: { x: 2, y: 0, z: 0 } });
    const p3 = projectPointToLine(query, { ...base, direction: { x: -3, y: 0, z: 0 } });
    expect(p2?.point).toEqual(p1?.point);
    expect(p3?.point).toEqual(p1?.point);
    expect(p2?.distance).toBe(p1?.distance);
    // Parameters naturally differ (t=3 vs 1.5 vs -1).
    expect(p1?.parameter).toBeCloseTo(3, 12);
    expect(p2?.parameter).toBeCloseTo(1.5, 12);
    expect(p3?.parameter).toBeCloseTo(-1, 12);
    // Projection residual perpendicular to direction (PART 41).
    const residual = { x: query.x - (p1?.point.x ?? 0), y: query.y - (p1?.point.y ?? 0), z: 0 };
    expect(Math.abs(residual.x * 1 + residual.y * 0)).toBeLessThan(1e-12);
  });

  it("clamps behind-origin ray queries to the origin", () => {
    const behind = projectPointToRay(
      { x: -3, y: 4, z: 0 },
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }
    );
    expect(behind?.point).toEqual({ x: 0, y: 0, z: 0 });
    expect(behind?.boundary).toBe("origin");
    expect(behind?.distance).toBe(5);
    const ahead = projectPointToRay(
      { x: 3, y: 4, z: 0 },
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }
    );
    expect(ahead?.point).toEqual({ x: 3, y: 0, z: 0 });
    expect(ahead?.distance).toBe(4);
  });

  it("clamps segment queries to endpoints, degenerate answers A", () => {
    const past = projectPointToSegment(
      { x: 3, y: 4, z: 0 },
      { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }
    );
    expect(past?.point).toEqual({ x: 2, y: 0, z: 0 });
    expect(past?.distance).toBeCloseTo(Math.sqrt(17), 12);
    expect(past?.boundary).toBe("end");
    const before = projectPointToSegment(
      { x: -3, y: 4, z: 0 },
      { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }
    );
    expect(before?.point).toEqual({ x: 0, y: 0, z: 0 });
    expect(before?.boundary).toBe("start");
    const degenerate = projectPointToSegment(
      { x: 3, y: 4, z: 0 },
      { start: { x: 1, y: 1, z: 1 }, end: { x: 1, y: 1, z: 1 } }
    );
    expect(degenerate?.point).toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe("line-line relations (S27 PART 16-17/36)", () => {
  it("intersects L1=x-axis with L2=(1,-1,0)+t<0,1,0> at (1,0,0)", () => {
    const relation = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), line([1, -1, 0], [0, 1, 0]));
    expect(relation?.kind).toBe("intersect");
    if (relation?.kind === "intersect") {
      expect(relation.point.x).toBeCloseTo(1, 9);
      expect(relation.point.y).toBeCloseTo(0, 9);
      expect(relation.point.z).toBeCloseTo(0, 9);
      expect(relation.distance).toBe(0);
    }
  });

  it("finds skew closest (0,0,0)/(0,0,1) with distance 1", () => {
    // S27-R1: the session text lists (0,1,1)/sqrt(2) here, but that pair
    // fails the spec's own perpendicular-connector invariant
    // ((0,0,0)-(0,1,1))·<0,1,0> = -1. The exact closest for these inputs
    // is (0,0,0)/(0,0,1) at distance 1 — asserted with the invariant.
    const relation = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), line([0, 1, 1], [0, 1, 0]));
    expect(relation?.kind).toBe("skew");
    if (relation?.kind === "skew") {
      expect(relation.pointA).toEqual({ x: 0, y: 0, z: 0 });
      expect(relation.pointB).toEqual({ x: 0, y: 0, z: 1 });
      expect(relation.distance).toBeCloseTo(1, 9);
      // Connector perpendicular to BOTH directions (PART 41).
      const connector = {
        x: relation.pointA.x - relation.pointB.x,
        y: relation.pointA.y - relation.pointB.y,
        z: relation.pointA.z - relation.pointB.z
      };
      expect(Math.abs(connector.x * 1 + connector.y * 0 + connector.z * 0)).toBeLessThan(1e-9);
      expect(Math.abs(connector.x * 0 + connector.y * 1 + connector.z * 0)).toBeLessThan(1e-9);
    }
  });

  it("separates parallel lines by distance 2", () => {
    const relation = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), line([0, 2, 0], [1, 0, 0]));
    expect(relation?.kind).toBe("parallel-disjoint");
    if (relation?.kind === "parallel-disjoint") {
      expect(relation.distance).toBeCloseTo(2, 9);
    }
  });

  it("coincides scaled/negative-direction x-axes", () => {
    const relation = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), line([5, 0, 0], [-2, 0, 0]));
    expect(relation?.kind).toBe("coincident");
  });
});

describe("segment and ray relations (S27 PART 16/36)", () => {
  it("intersects crossing and touching segments", () => {
    const crossing = relateLinearPrimitives(segment([0, 0, 0], [2, 0, 0]), segment([1, -1, 0], [1, 1, 0]));
    expect(crossing?.kind).toBe("intersect");
    const touch = relateLinearPrimitives(segment([0, 0, 0], [1, 0, 0]), segment([1, 0, 0], [2, 1, 0]));
    expect(touch?.kind).toBe("intersect");
    if (touch?.kind === "intersect") {
      expect(touch.point.x).toBeCloseTo(1, 9);
    }
  });

  it("overlaps collinear segments and touches at a point", () => {
    const overlap = relateLinearPrimitives(segment([0, 0, 0], [2, 0, 0]), segment([1, 0, 0], [3, 0, 0]));
    expect(overlap?.kind).toBe("overlap");
    if (overlap?.kind === "overlap") {
      expect(overlap.start?.x).toBeCloseTo(1, 9);
      expect(overlap.end?.x).toBeCloseTo(2, 9);
      expect(overlap.bounded).toBe("segment");
    }
    const touch = relateLinearPrimitives(segment([0, 0, 0], [1, 0, 0]), segment([1, 0, 0], [2, 0, 0]));
    expect(touch?.kind).toBe("intersect");
  });

  it("separates parallel-disjoint segments by distance", () => {
    const relation = relateLinearPrimitives(segment([0, 0, 0], [1, 0, 0]), segment([0, 2, 0], [1, 2, 0]));
    expect(relation?.kind).toBe("parallel-disjoint");
    if (relation?.kind === "parallel-disjoint") {
      expect(relation.distance).toBeCloseTo(2, 9);
    }
  });

  it("reduces degenerate point segments correctly", () => {
    // Pair-level reduction answers point-vs-line through the operand API
    // (linearFromSegment stays null for degenerate inputs by design).
    const onLine = relateLinearObjects(
      { kind: "segment", segment: { start: { x: 1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } } },
      { kind: "line", line: { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } } }
    );
    expect(onLine?.kind).toBe("intersect");
    const offLine = relateLinearObjects(
      { kind: "segment", segment: { start: { x: 1, y: 2, z: 0 }, end: { x: 1, y: 2, z: 0 } } },
      { kind: "line", line: { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } } }
    );
    expect(offLine?.kind).toBe("disjoint");
    if (offLine?.kind === "disjoint") {
      expect(offLine.distance).toBeCloseTo(2, 9);
    }
    const bothPoints = relateLinearObjects(
      { kind: "segment", segment: { start: { x: 1, y: 1, z: 1 }, end: { x: 1, y: 1, z: 1 } } },
      { kind: "segment", segment: { start: { x: 1, y: 1, z: 1 }, end: { x: 1, y: 1, z: 1 } } }
    );
    expect(bothPoints?.kind).toBe("intersect");
  });

  it("classifies ray pairs: origin touch, overlap, facing, disjoint, skew", () => {
    const opposite = relateLinearPrimitives(ray([0, 0, 0], [1, 0, 0]), ray([0, 0, 0], [-1, 0, 0]));
    expect(opposite?.kind).toBe("intersect");
    if (opposite?.kind === "intersect") {
      expect(opposite.point).toEqual({ x: 0, y: 0, z: 0 });
    }
    const sameDir = relateLinearPrimitives(ray([0, 0, 0], [1, 0, 0]), ray([2, 0, 0], [1, 0, 0]));
    expect(sameDir?.kind).toBe("overlap");
    if (sameDir?.kind === "overlap") {
      expect(sameDir.bounded).toBe("ray");
      expect(sameDir.start?.x).toBeCloseTo(2, 9);
    }
    const facing = relateLinearPrimitives(ray([0, 0, 0], [1, 0, 0]), ray([4, 0, 0], [-1, 0, 0]));
    expect(facing?.kind).toBe("overlap");
    if (facing?.kind === "overlap") {
      expect(facing.bounded).toBe("segment");
    }
    const away = relateLinearPrimitives(ray([0, 0, 0], [-1, 0, 0]), ray([4, 0, 0], [1, 0, 0]));
    expect(away?.kind).toBe("parallel-disjoint");
    if (away?.kind === "parallel-disjoint") {
      expect(away.distance).toBeCloseTo(4, 9);
    }
    const skewRays = relateLinearPrimitives(ray([0, 0, 0], [1, 0, 0]), ray([0, 1, 1], [0, 1, 0]));
    expect(skewRays?.kind).toBe("disjoint");
  });

  it("classifies unbounded collinear overlaps without collapsing (S27-R4)", () => {
    // Line-ray: shared set is the ray itself.
    const lineRay = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), ray([2, 0, 0], [1, 0, 0]));
    expect(lineRay?.kind).toBe("overlap");
    if (lineRay?.kind === "overlap") {
      expect(lineRay.bounded).toBe("ray");
      expect(lineRay.start?.x).toBeCloseTo(2, 9);
      expect(lineRay.end).toBeNull();
      expect(lineRay.direction?.x).toBeGreaterThan(0);
    }
    // Opposite collinear rays facing each other: finite segment overlap.
    const facing = relateLinearPrimitives(ray([0, 0, 0], [1, 0, 0]), ray([4, 0, 0], [-1, 0, 0]));
    expect(facing?.kind).toBe("overlap");
    if (facing?.kind === "overlap") {
      expect(facing.bounded).toBe("segment");
      expect(facing.start?.x).toBeCloseTo(0, 9);
      expect(facing.end?.x).toBeCloseTo(4, 9);
    }
    // Line-line stays coincident (never a spurious point).
    const coincident = relateLinearPrimitives(line([0, 0, 0], [1, 0, 0]), line([3, 0, 0], [-5, 0, 0]));
    expect(coincident?.kind).toBe("coincident");
  });

  it("rejects line-ray behind-origin hits and accepts forward hits", () => {
    const behind = relateLinearPrimitives(line([0, 0, 0], [0, 1, 0]), ray([0, 0, 0], [1, 0, 0]));
    // x-axis ray vs y-axis line through origin: they meet at origin, which
    // IS in the ray domain.
    expect(behind?.kind).toBe("intersect");
    const miss = relateLinearPrimitives(line([5, 0, 0], [0, 1, 0]), ray([0, 0, 0], [1, 0, 0]));
    // Line x=5 meets the x-axis ray at (5,0,0), t=5 ≥ 0: forward hit.
    expect(miss?.kind).toBe("intersect");
    const behindOnly = relateLinearPrimitives(line([-5, 0, 0], [0, 1, 0]), ray([0, 0, 0], [1, 0, 0]));
    // Unconstrained crossing at (-5,0,0) lies behind the ray origin.
    expect(behindOnly?.kind).toBe("disjoint");
    if (behindOnly?.kind === "disjoint") {
      expect(behindOnly.distance).toBeCloseTo(5, 9);
    }
  });

  it("misses segment extensions and hits endpoints", () => {
    const extension = relateLinearPrimitives(
      line([5, 0, 0], [0, 1, 0]),
      segment([0, 0, 0], [2, 0, 0])
    );
    expect(extension?.kind).toBe("disjoint");
    const endpoint = relateLinearPrimitives(
      line([2, 0, 0], [0, 1, 0]),
      segment([0, 0, 0], [2, 0, 0])
    );
    expect(endpoint?.kind).toBe("intersect");
  });
});

describe("linear-plane domain enforcement (S27 PART 15/37)", () => {
  const plane = { normal: { x: 0, y: 0, z: 1 }, constant: -2 };

  it("hits interior points and rejects extensions", () => {
    const hit = intersectLinearPlane(segment([0, 0, 0], [0, 0, 4]), plane);
    expect(hit?.kind).toBe("point");
    if (hit?.kind === "point") {
      expect(hit.point).toEqual({ x: 0, y: 0, z: 2 });
    }
    const extension = intersectLinearPlane(segment([0, 0, 0], [0, 0, 1]), plane);
    expect(extension?.kind).toBe("outside-domain");
    const endpoint = intersectLinearPlane(segment([0, 0, 2], [0, 0, 5]), plane);
    expect(endpoint?.kind).toBe("point");
  });

  it("rejects behind-origin ray hits", () => {
    const behind = intersectLinearPlane(
      { origin: { x: 0, y: 0, z: 5 }, direction: { x: 0, y: 0, z: 1 }, tMin: 0, tMax: Number.POSITIVE_INFINITY },
      plane
    );
    expect(behind?.kind).toBe("outside-domain");
    const forward = intersectLinearPlane(
      { origin: { x: 0, y: 0, z: 5 }, direction: { x: 0, y: 0, z: -1 }, tMin: 0, tMax: Number.POSITIVE_INFINITY },
      plane
    );
    expect(forward?.kind).toBe("point");
  });
});
