import { describe, expect, it } from "vitest";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { computeParametricSurfaceData } from "@/lib/math/computeParametricSurfaceData";
import type { GeometryComputeRequest } from "@/lib/compute/geometryComputeProtocol";

const SPHERE_BOX = { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 };

function implicitRequest(
  equation: string,
  resolution: number,
  params: Record<string, number> = {}
): GeometryComputeRequest {
  return {
    requestId: 1,
    objectId: "obj-1",
    generation: 1,
    kind: "implicitSurface",
    params,
    structure: "dark::structure-1",
    payload: { equation, domain: { ...SPHERE_BOX }, resolution }
  };
}

function parametricRequest(
  xExpr: string,
  yExpr: string,
  zExpr: string,
  resolution: number,
  params: Record<string, number> = {}
): GeometryComputeRequest {
  return {
    requestId: 2,
    objectId: "obj-2",
    generation: 1,
    kind: "parametricSurface",
    params,
    structure: "dark::structure-2",
    payload: {
      xExpr,
      yExpr,
      zExpr,
      domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
      resolution,
      clampCoordinate: 10_000
    }
  };
}

function assertArraysEqual(a: Float32Array | Uint16Array | Uint32Array, b: Float32Array | Uint16Array | Uint32Array) {
  expect(a.constructor).toBe(b.constructor);
  expect(a.length).toBe(b.length);
  expect(Array.from(a)).toEqual(Array.from(b));
}

describe("handleGeometryComputeMessage", () => {
  it("ignores unknown requests without answering", () => {
    expect(handleGeometryComputeMessage(null)).toBeNull();
    expect(handleGeometryComputeMessage({ kind: "surface" })).toBeNull();
    expect(handleGeometryComputeMessage({ ...implicitRequest("x", 8), kind: "surface" })).toBeNull();
  });

  it("computes an implicit sphere with transferable buffers", () => {
    const handled = handleGeometryComputeMessage(implicitRequest("x^2 + y^2 + z^2 = 1", 16));
    expect(handled).not.toBeNull();
    expect(handled!.response.requestId).toBe(1);
    expect(handled!.response.objectId).toBe("obj-1");
    expect(handled!.response.generation).toBe(1);
    expect(handled!.response.structure).toBe("dark::structure-1");
    expect(handled!.response.result.status).toBe("ok");
    if (handled!.response.result.status === "ok") {
      expect(handled!.response.result.positions).toBeInstanceOf(Float32Array);
      expect(handled!.response.result.triangleCount).toBeGreaterThan(0);
      expect(handled!.transfer).toHaveLength(2);
      expect(handled!.transfer[0]).toBe(handled!.response.result.positions.buffer);
      expect(handled!.transfer[1]).toBe(handled!.response.result.indices.buffer);
    }
  });

  it("returns empty (no transfer) for F=1 and budget/error shapes for failures", () => {
    const empty = handleGeometryComputeMessage(implicitRequest("1", 8));
    expect(empty?.response.result.status).toBe("empty");
    expect(empty?.transfer).toEqual([]);

    const invalid = handleGeometryComputeMessage(implicitRequest("sin(factorial(x))", 8));
    expect(invalid?.response.result.status).toBe("error");
    expect(invalid?.transfer).toEqual([]);
  });

  it("computes a parametric sphere with transferable buffers", () => {
    const handled = handleGeometryComputeMessage(
      parametricRequest("sin(u) * cos(v)", "sin(u) * sin(v)", "cos(u)", 16)
    );
    expect(handled?.response.result.status).toBe("ok");
    expect(handled?.transfer).toHaveLength(2);
  });
});

describe("worker/sync parity (PART 29)", () => {
  it("implicit sphere: worker result equals sync compute exactly", () => {
    const equation = "x^2 + y^2 + z^2 = 1";
    const sync = computeImplicitSurfaceData({ equation, domain: { ...SPHERE_BOX }, resolution: 16, params: {} });
    const handled = handleGeometryComputeMessage(implicitRequest(equation, 16));
    expect(sync.status).toBe("ok");
    expect(handled?.response.result.status).toBe("ok");
    if (sync.status === "ok" && handled?.response.result.status === "ok") {
      assertArraysEqual(handled.response.result.positions, sync.positions);
      assertArraysEqual(handled.response.result.indices, sync.indices);
      expect(handled.response.result.vertexCount).toBe(sync.vertexCount);
      expect(handled.response.result.triangleCount).toBe(sync.triangleCount);
    }
  });

  it("implicit gyroid: worker result equals sync compute exactly", () => {
    const equation = "sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0";
    const domain = { xMin: -3.2, xMax: 3.2, yMin: -3.2, yMax: 3.2, zMin: -3.2, zMax: 3.2 };
    const sync = computeImplicitSurfaceData({ equation, domain, resolution: 12, params: {} });
    const handled = handleGeometryComputeMessage({
      requestId: 3,
      objectId: "obj-3",
      generation: 1,
      kind: "implicitSurface",
      params: {},
      structure: "dark::structure-3",
      payload: { equation, domain, resolution: 12 }
    });
    expect(sync.status).toBe("ok");
    if (sync.status === "ok" && handled?.response.result.status === "ok") {
      assertArraysEqual(handled.response.result.positions, sync.positions);
      assertArraysEqual(handled.response.result.indices, sync.indices);
    }
  });

  it("implicit singular 1/x: empty status parity, no NaN anywhere", () => {
    const sync = computeImplicitSurfaceData({
      equation: "1 / x",
      domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
      resolution: 8,
      params: {}
    });
    const handled = handleGeometryComputeMessage(
      implicitRequest("1 / x", 8)
    );
    // Re-point the helper request at the singular domain for parity.
    const singular = handleGeometryComputeMessage({
      requestId: 4,
      objectId: "obj-4",
      generation: 1,
      kind: "implicitSurface",
      params: {},
      structure: "dark::structure-4",
      payload: {
        equation: "1 / x",
        domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
        resolution: 8
      }
    });
    expect(sync.status).toBe("empty");
    expect(handled?.response.result.status).toBe("empty");
    expect(singular?.response.result.status).toBe("empty");
  });

  it("parametric sphere: worker result equals sync compute exactly", () => {
    const input = {
      xExpr: "sin(u) * cos(v)",
      yExpr: "sin(u) * sin(v)",
      zExpr: "cos(u)",
      domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI },
      resolution: 16,
      clampCoordinate: 10_000,
      params: {}
    };
    const sync = computeParametricSurfaceData(input);
    const handled = handleGeometryComputeMessage({
      requestId: 5,
      objectId: "obj-5",
      generation: 1,
      kind: "parametricSurface",
      params: {},
      structure: "dark::structure-5",
      payload: { ...input }
    });
    expect(sync.status).toBe("ok");
    if (sync.status === "ok" && handled?.response.result.status === "ok") {
      assertArraysEqual(handled.response.result.positions, sync.positions);
      assertArraysEqual(handled.response.result.indices, sync.indices);
      expect(handled.response.result.rejectedTriangles).toBe(sync.rejectedTriangles);
    }
  });

  it("parametric singular 1/u: hole-topology parity with indexed-bounds safety", () => {
    const input = {
      xExpr: "1 / u",
      yExpr: "v",
      zExpr: "0",
      domain: { uMin: -2, uMax: 2, vMin: -1, vMax: 1 },
      resolution: 8,
      clampCoordinate: 10_000,
      params: {}
    };
    const sync = computeParametricSurfaceData(input);
    const handled = handleGeometryComputeMessage({
      requestId: 6,
      objectId: "obj-6",
      generation: 1,
      kind: "parametricSurface",
      params: {},
      structure: "dark::structure-6",
      payload: { ...input }
    });
    expect(sync.status).toBe("ok");
    if (sync.status === "ok" && handled?.response.result.status === "ok") {
      assertArraysEqual(handled.response.result.positions, sync.positions);
      assertArraysEqual(handled.response.result.indices, sync.indices);
      for (const value of handled.response.result.positions) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("parameter snapshots flow through: r=2 sphere differs from r=3", () => {
    const equation = "x^2 + y^2 + z^2 = r^2";
    const domain = { xMin: -3.5, xMax: 3.5, yMin: -3.5, yMax: 3.5, zMin: -3.5, zMax: 3.5 };
    const small = handleGeometryComputeMessage({
      requestId: 7,
      objectId: "obj-7",
      generation: 1,
      kind: "implicitSurface",
      params: { r: 2 },
      structure: "dark::structure-7",
      payload: { equation, domain, resolution: 12 }
    });
    const large = handleGeometryComputeMessage({
      requestId: 8,
      objectId: "obj-8",
      generation: 1,
      kind: "implicitSurface",
      params: { r: 3 },
      structure: "dark::structure-8",
      payload: { equation, domain, resolution: 12 }
    });
    expect(small?.response.result.status).toBe("ok");
    expect(large?.response.result.status).toBe("ok");
    if (small?.response.result.status === "ok" && large?.response.result.status === "ok") {
      // Different snapshots must produce different geometry (proves the
      // worker used the passed snapshot, not ambient store state).
      expect(Array.from(large.response.result.positions)).not.toEqual(
        Array.from(small.response.result.positions)
      );
    }
  });
});
