import { describe, expect, it } from "vitest";
import { compileGeometryCoordinate } from "@/lib/math/compileGeometryCoordinate";
import {
  resolveLineGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry
} from "@/lib/math/geometryResolve";

describe("geometry coordinate compiler (S26 PART 4/38)", () => {
  it("compiles numeric literals, pi/e, and parameters", () => {
    expect(compileGeometryCoordinate("1", {}).error).toBeNull();
    expect(compileGeometryCoordinate("1", {}).evaluate({})).toBe(1);
    expect(compileGeometryCoordinate("pi", {}).evaluate({})).toBeCloseTo(Math.PI, 12);
    expect(compileGeometryCoordinate("e", {}).evaluate({})).toBeCloseTo(Math.E, 12);
    const param = compileGeometryCoordinate("2*a", { a: 2 });
    expect(param.error).toBeNull();
    expect(param.evaluate({ a: 2 })).toBe(4);
    expect(param.evaluate({ a: 3 })).toBe(6);
  });

  it("rejects spatial locals, assignments, unsafe functions, unknown symbols", () => {
    for (const expr of ["x", "y", "z", "y + 1", "t", "u", "v", "a = 3", "sin(factorial(a))", "q + 1"]) {
      expect(compileGeometryCoordinate(expr, { a: 1 }).error).not.toBeNull();
    }
    expect(compileGeometryCoordinate("", {}).error).not.toBeNull();
  });
});

describe("primitive resolution (S26 PART 10/36/37)", () => {
  it("resolves the vector matrix case: endpoint (5,7,9), magnitude sqrt(77)", () => {
    const resolved = resolveVectorGeometry(["1", "2", "3"], ["4", "5", "6"], {});
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") {
      return;
    }
    expect(resolved.degenerate).toBe(false);
    expect(resolved.value.origin).toEqual({ x: 1, y: 2, z: 3 });
    // Endpoint is derived (origin + components), never stored.
    const endpoint = {
      x: resolved.value.origin.x + resolved.value.vector.x,
      y: resolved.value.origin.y + resolved.value.vector.y,
      z: resolved.value.origin.z + resolved.value.vector.z
    };
    expect(endpoint).toEqual({ x: 5, y: 7, z: 9 });
    expect(resolved.value.magnitude).toBeCloseTo(Math.sqrt(77), 12);
  });

  it("keeps zero vectors valid with origin endpoint and no direction", () => {
    const resolved = resolveVectorGeometry(["1", "2", "3"], ["0", "0", "0"], {});
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") {
      return;
    }
    expect(resolved.degenerate).toBe(true);
    expect(resolved.value.magnitude).toBe(0);
    expect(resolved.value.origin).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("resolves line P=(1,2,3) d=<2,-1,4> and rejects zero direction", () => {
    const resolved = resolveLineGeometry(["1", "2", "3"], ["2", "-1", "4"], {});
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") {
      return;
    }
    expect(resolved.value.point).toEqual({ x: 1, y: 2, z: 3 });
    expect(resolved.value.direction).toEqual({ x: 2, y: -1, z: 4 });
    const zero = resolveLineGeometry(["0", "0", "0"], ["0", "0", "0"], {});
    expect(zero.status).toBe("invalid");
    if (zero.status === "invalid") {
      expect(zero.reason).toMatch(/nonzero/i);
    }
  });

  it("resolves rays and rejects zero direction", () => {
    const resolved = resolveRayGeometry(["1", "1", "1"], ["1", "0", "0"], {});
    expect(resolved.status).toBe("ok");
    const zero = resolveRayGeometry(["0", "0", "0"], ["0", "0", "0"], {});
    expect(zero.status).toBe("invalid");
  });

  it("resolves segments and keeps coincident endpoints valid", () => {
    const resolved = resolveSegmentGeometry(["0", "0", "0"], ["2", "4", "6"], {});
    expect(resolved.status).toBe("ok");
    if (resolved.status !== "ok") {
      return;
    }
    expect(resolved.degenerate).toBe(false);
    const point = resolveSegmentGeometry(["1", "1", "1"], ["1", "1", "1"], {});
    expect(point.status).toBe("ok");
    if (point.status === "ok") {
      expect(point.degenerate).toBe(true);
    }
  });

  it("threads parameters without rebuilds: <a,2a,0> follows a=2->3", () => {
    const atTwo = resolveVectorGeometry(["0", "0", "0"], ["a", "2*a", "0"], { a: 2 });
    const atThree = resolveVectorGeometry(["0", "0", "0"], ["a", "2*a", "0"], { a: 3 });
    expect(atTwo.status).toBe("ok");
    expect(atThree.status).toBe("ok");
    if (atTwo.status === "ok" && atThree.status === "ok") {
      expect(atTwo.value.vector).toEqual({ x: 2, y: 4, z: 0 });
      expect(atThree.value.vector).toEqual({ x: 3, y: 6, z: 0 });
    }
  });

  it("fails closed on invalid coordinates with precise reasons", () => {
    const bad = resolveLineGeometry(["x", "0", "0"], ["1", "0", "0"], {});
    expect(bad.status).toBe("invalid");
    const nonFinite = resolveSegmentGeometry(["1/0", "0", "0"], ["0", "0", "0"], {});
    expect(nonFinite.status).toBe("invalid");
  });
});
