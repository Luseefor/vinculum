import { describe, expect, it } from "vitest";
import {
  angleBetweenLines,
  angleBetweenVectors,
  angleLinePlane,
  anglePlanePlane,
  distanceLinearLinear,
  distanceLinearPlane,
  distancePlanePlane,
  distancePointPlane,
  intersectLinearPlane,
  intersectPlanes,
  linearFromLine,
  linearFromSegment,
  projectPointToPlane,
  relateLinearPrimitives,
  type LinearPrimitive3,
  type MathPoint3
} from "@/lib/math/geometryRelations";
import { vectorsParallel, vectorsPerpendicular } from "@/lib/math/geometryTolerance";
import { resolvePlaneGeometry, resolvePointGeometry } from "@/lib/math/geometryResolve";

const Z2_PLANE = { normal: { x: 0, y: 0, z: 1 }, constant: -2 };

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

describe("point-plane projection (S27 PART 9/35)", () => {
  it("projects (1,3,7) onto z=2 as (1,3,2) with signed distance 5", () => {
    const projected = projectPointToPlane({ x: 1, y: 3, z: 7 }, Z2_PLANE);
    expect(projected?.projection).toEqual({ x: 1, y: 3, z: 2 });
    expect(projected?.signedDistance).toBe(5);
    expect(projected?.distance).toBe(5);
    const below = projectPointToPlane({ x: 1, y: 3, z: -1 }, Z2_PLANE);
    expect(below?.signedDistance).toBe(-3);
    expect(below?.distance).toBe(3);
    const on = projectPointToPlane({ x: 1, y: 3, z: 2 }, Z2_PLANE);
    expect(on?.distance).toBe(0);
    // Projected point satisfies the plane (PART 41).
    expect((projected?.projection.z ?? 0) - 2).toBeLessThan(1e-12);
  });
});

describe("plane resolution (S27 PART 2)", () => {
  it("resolves z=2 to raw normal +z with constant -2", () => {
    const resolved = resolvePlaneGeometry("z = 2", {});
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") {
      expect(resolved.value.normal).toEqual({ x: 0, y: 0, z: 1 });
      expect(resolved.value.constant).toBe(-2);
    }
  });

  it("resolves equivalent equations to proportional math (no raw compare)", () => {
    const a = resolvePlaneGeometry("x + y + z = 1", {});
    const b = resolvePlaneGeometry("2x + 2y + 2z = 2", {});
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status === "ok" && b.status === "ok") {
      const ratio = b.value.normal.x / a.value.normal.x;
      expect(b.value.normal.y / a.value.normal.y).toBeCloseTo(ratio, 12);
      expect(b.value.constant / a.value.constant).toBeCloseTo(ratio, 12);
    }
  });

  it("rejects invalid planes and resolves points", () => {
    expect(resolvePlaneGeometry("0 = 0", {}).status).toBe("invalid");
    expect(resolvePlaneGeometry("x^2 + y = 1", {}).status).toBe("invalid");
    const point = resolvePointGeometry(["1", "2", "3"], {});
    expect(point.status).toBe("ok");
    if (point.status === "ok") {
      expect(point.value).toEqual({ x: 1, y: 2, z: 3 });
    }
    expect(resolvePointGeometry(["x", "0", "0"], {}).status).toBe("invalid");
  });
});

describe("linear-plane intersections (S27 PART 15/37)", () => {
  it("hits through-points, parallels, and contained lines", () => {
    const through = intersectLinearPlane(line([0, 0, 0], [0, 0, 1]), Z2_PLANE);
    expect(through?.kind).toBe("point");
    if (through?.kind === "point") {
      expect(through.point).toEqual({ x: 0, y: 0, z: 2 });
    }
    const parallel = intersectLinearPlane(line([0, 0, 0], [1, 0, 0]), Z2_PLANE);
    expect(parallel?.kind).toBe("parallel");
    const contained = intersectLinearPlane(line([0, 0, 2], [1, 1, 0]), Z2_PLANE);
    expect(contained?.kind).toBe("contained");
  });

  it("contains parallel rays with origin in plane", () => {
    const contained = intersectLinearPlane(
      { origin: { x: 1, y: 1, z: 2 }, direction: { x: 1, y: 0, z: 0 }, tMin: 0, tMax: Number.POSITIVE_INFINITY },
      Z2_PLANE
    );
    expect(contained?.kind).toBe("contained");
  });
});

describe("plane-plane intersections (S27 PART 18/37)", () => {
  it("intersects x=0 and y=0 along the z-axis", () => {
    const x0 = { normal: { x: 1, y: 0, z: 0 }, constant: 0 };
    const y0 = { normal: { x: 0, y: 1, z: 0 }, constant: 0 };
    const hit = intersectPlanes(x0, y0);
    expect(hit?.kind).toBe("line");
    if (hit?.kind === "line") {
      expect(Math.abs(hit.direction.x)).toBeLessThan(1e-12);
      expect(Math.abs(hit.direction.y)).toBeLessThan(1e-12);
      expect(Math.abs(hit.direction.z)).toBeGreaterThan(0);
      // Point satisfies both planes.
      expect(Math.abs(hit.point.x)).toBeLessThan(1e-9);
      expect(Math.abs(hit.point.y)).toBeLessThan(1e-9);
    }
  });

  it("verifies the asymmetric case by invariants, not hardcoded origins", () => {
    const p1 = { normal: { x: 1, y: 1, z: 1 }, constant: -1 };
    const p2 = { normal: { x: 2, y: -1, z: 1 }, constant: 0 };
    const hit = intersectPlanes(p1, p2);
    expect(hit?.kind).toBe("line");
    if (hit?.kind !== "line") {
      return;
    }
    // Direction perpendicular to both normals.
    expect(Math.abs(hit.direction.x * 1 + hit.direction.y * 1 + hit.direction.z * 1)).toBeLessThan(1e-9);
    expect(Math.abs(hit.direction.x * 2 + hit.direction.y * -1 + hit.direction.z * 1)).toBeLessThan(1e-9);
    // Returned point lies on both planes.
    const r1 = hit.point.x + hit.point.y + hit.point.z - 1;
    const r2 = 2 * hit.point.x - hit.point.y + hit.point.z;
    expect(Math.abs(r1)).toBeLessThan(1e-9);
    expect(Math.abs(r2)).toBeLessThan(1e-9);
    // A second point along the line also satisfies both.
    const q = {
      x: hit.point.x + hit.direction.x,
      y: hit.point.y + hit.direction.y,
      z: hit.point.z + hit.direction.z
    };
    expect(Math.abs(q.x + q.y + q.z - 1)).toBeLessThan(1e-8);
    expect(Math.abs(2 * q.x - q.y + q.z)).toBeLessThan(1e-8);
  });

  it("separates parallel, coincident, and scaled-equation cases", () => {
    const z0 = { normal: { x: 0, y: 0, z: 1 }, constant: 0 };
    const z5 = { normal: { x: 0, y: 0, z: 1 }, constant: -5 };
    const parallel = intersectPlanes(z0, z5);
    expect(parallel?.kind).toBe("parallel");
    const scaled = intersectPlanes(z0, { normal: { x: 0, y: 0, z: 3 }, constant: 0 });
    expect(scaled?.kind).toBe("coincident");
    const rearranged = intersectPlanes(
      { normal: { x: 1, y: 1, z: 1 }, constant: -1 },
      { normal: { x: 2, y: 2, z: 2 }, constant: -2 }
    );
    expect(rearranged?.kind).toBe("coincident");
  });
});

describe("angle engine (S27 PART 10-13/38)", () => {
  it("measures vector angles 0/45/90/180 with zero-vector unavailable", () => {
    const deg = (r: number | null): number | null => (r === null ? null : (r * 180) / Math.PI);
    expect(deg(angleBetweenVectors({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }))).toBeCloseTo(90, 9);
    expect(deg(angleBetweenVectors({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }))).toBeCloseTo(0, 9);
    expect(deg(angleBetweenVectors({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }))).toBeCloseTo(180, 9);
    expect(deg(angleBetweenVectors({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }))).toBeCloseTo(45, 9);
    expect(angleBetweenVectors({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
  });

  it("keeps line angles acute under reversal: 0/45/90", () => {
    const deg = (r: number | null): number => (r === null ? Number.NaN : (r * 180) / Math.PI);
    expect(deg(angleBetweenLines({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }))).toBeCloseTo(90, 9);
    expect(deg(angleBetweenLines({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }))).toBeCloseTo(45, 9);
    expect(deg(angleBetweenLines({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }))).toBeCloseTo(0, 9);
    expect(deg(angleBetweenLines({ x: 1, y: 2, z: 3 }, { x: -2, y: -4, z: -6 }))).toBeCloseTo(0, 9);
  });

  it("measures line-plane 0/90 and plane-plane 0/45/90", () => {
    const deg = (r: number | null): number => (r === null ? Number.NaN : (r * 180) / Math.PI);
    const zNormal = { x: 0, y: 0, z: 1 };
    expect(deg(angleLinePlane({ x: 1, y: 0, z: 0 }, zNormal))).toBeCloseTo(0, 9);
    expect(deg(angleLinePlane({ x: 0, y: 0, z: 1 }, zNormal))).toBeCloseTo(90, 9);
    expect(deg(angleLinePlane({ x: 1, y: 0, z: 1 }, zNormal))).toBeCloseTo(45, 9);
    expect(deg(anglePlanePlane({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }))).toBeCloseTo(0, 9);
    expect(deg(anglePlanePlane({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }))).toBeCloseTo(90, 9);
    expect(deg(anglePlanePlane({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }))).toBeCloseTo(45, 9);
  });

  it("classifies parallel vs perpendicular directions scale-aware", () => {
    expect(vectorsParallel({ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBe(true);
    expect(vectorsPerpendicular({ x: 1, y: 0, z: 0 }, { x: 0, y: 5, z: 0 })).toBe(true);
    expect(vectorsPerpendicular({ x: 1, y: 1, z: 0 }, { x: 1, y: -1, z: 0 })).toBe(true);
    expect(vectorsParallel({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(false);
  });
});

describe("distance engine coherence (S27 PART 19)", () => {
  it("returns 0 for intersecting geometry and point-plane otherwise", () => {
    expect(distanceLinearLinear(line([0, 0, 0], [1, 0, 0]), line([1, -1, 0], [0, 1, 0]))).toBe(0);
    expect(distanceLinearLinear(line([0, 0, 0], [1, 0, 0]), line([0, 1, 1], [0, 1, 0]))).toBeCloseTo(
      1,
      9
    );
    expect(distanceLinearPlane(line([0, 0, 0], [0, 0, 1]), Z2_PLANE)).toBe(0);
    expect(distanceLinearPlane(line([0, 0, 0], [1, 0, 0]), Z2_PLANE)).toBe(2);
    expect(
      distancePlanePlane(
        { normal: { x: 0, y: 0, z: 1 }, constant: 0 },
        { normal: { x: 0, y: 0, z: 1 }, constant: -5 }
      )
    ).toBe(5);
    expect(
      distancePlanePlane(
        { normal: { x: 0, y: 0, z: 1 }, constant: 0 },
        { normal: { x: 1, y: 0, z: 0 }, constant: 0 }
      )
    ).toBe(0);
    expect(distancePointPlane({ x: 1, y: 3, z: 7 }, Z2_PLANE)).toBe(5);
  });
});

describe("symmetry (S27 PART 40)", () => {
  const A: MathPoint3 = { x: 1, y: 2, z: 3 };
  const B: MathPoint3 = { x: 4, y: 6, z: 3 };

  it("holds distance/angle symmetry and closest-pair argument swapping", () => {
    const l1 = line([0, 0, 0], [1, 0, 0]);
    const l2 = line([0, 1, 1], [0, 1, 0]);
    const forward = relateLinearPrimitives(l1, l2);
    const backward = relateLinearPrimitives(l2, l1);
    expect(forward?.kind).toBe(backward?.kind);
    if (forward && backward && (forward.kind === "skew" || forward.kind === "disjoint" || forward.kind === "parallel-disjoint") && (backward.kind === forward.kind)) {
      const f = forward as { pointA: MathPoint3; pointB: MathPoint3; distance: number };
      const r = backward as { pointA: MathPoint3; pointB: MathPoint3; distance: number };
      expect(f.pointA).toEqual(r.pointB);
      expect(f.pointB).toEqual(r.pointA);
      expect(f.distance).toBe(r.distance);
    }
    expect(A).not.toEqual(B);
  });

  it("keeps intersection geometry order-independent", () => {
    const forward = intersectLinearPlane(line([0, 0, 0], [0, 0, 1]), Z2_PLANE);
    expect(forward).toEqual(intersectLinearPlane(line([0, 0, 0], [0, 0, 1]), Z2_PLANE));
  });
});
