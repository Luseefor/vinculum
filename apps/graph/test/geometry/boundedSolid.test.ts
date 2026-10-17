import { describe, expect, it } from "vitest";
import { computeIntegralData, type IntegralComputeInput } from "@/lib/math/calculus/computeIntegralData";
import { measureSolidMesh } from "@/lib/math/geometry/boundedSolid";

function input(target: IntegralComputeInput["target"], mode: IntegralComputeInput["mode"] = "volume"): IntegralComputeInput {
  return { mode, target, scalarIntegrand: "", lowerBoundary: "0", field: null, quality: "medium", direction: 1, orientationSign: 1, params: {} };
}
const slab = { kind: "surface" as const, equation: "z=3", orientation: "z" as const, domain: { xMin: 0, xMax: 2, yMin: 0, yMax: 4 } };
const sphere = { kind: "implicitSurface" as const, equation: "x^2+y^2+z^2=1", domain: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 } };
const parametricSphere = { kind: "parametricSurface" as const, xExpr: "cos(u)*sin(v)", yExpr: "sin(u)*sin(v)", zExpr: "cos(v)", domain: { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: Math.PI } };

describe("between-function solids", () => {
  it("computes box volume and the entire boundary area, including all four walls", () => {
    expect(computeIntegralData(input(slab))).toMatchObject({ status: "ok", value: 24 });
    expect(computeIntegralData(input(slab, "solidArea"))).toMatchObject({ status: "ok", value: 52 });
    expect(computeIntegralData({ ...input(slab), lowerBoundary: "1" })).toMatchObject({ status: "ok", value: 16 });
  });
  it.each(["x", "y", "z"] as const)("uses the correct independent plane for output %s", axis => {
    const target = { ...slab, equation: `${axis}=3`, orientation: axis };
    expect(computeIntegralData(input(target)).value).toBeCloseTo(24, 10);
    expect(computeIntegralData(input(target, "solidArea")).value).toBeCloseTo(52, 10);
  });
  it("supports two variable height functions and geometric crossing volume", () => {
    const target = { ...slab, equation: "z=x+3", domain: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 } };
    expect(computeIntegralData({ ...input(target), lowerBoundary: "x+1" }).value).toBeCloseTo(2, 10);
    expect(computeIntegralData({ ...input(target, "solidArea"), lowerBoundary: "x+1" }).value).toBeCloseTo(8 + 2 * Math.sqrt(2), 8);
    const crossing = { ...target, equation: "z=x", domain: { xMin: -1, xMax: 1, yMin: 0, yMax: 1 } };
    expect(computeIntegralData(input(crossing)).value).toBeCloseTo(1, 10);
  });
  it("uses parameters and normalizes reversed geometric bounds", () => {
    const target = { ...slab, equation: "z=a", domain: { xMin: 2, xMax: 0, yMin: 4, yMax: 0 } };
    expect(computeIntegralData({ ...input(target), params: { a: 2 } }).value).toBeCloseTo(16, 10);
  });
  it("coincident functions enclose zero volume and zero solid boundary area", () => {
    expect(computeIntegralData({ ...input(slab, "solidArea"), lowerBoundary: "3" })).toMatchObject({ status: "ok", value: 0 });
  });
  it.each(["1/(x-0.13)", "sqrt(-x-1)", "x<1 ? 0 : 2", "unknown(x)", "z+1"])("rejects invalid or sampled non-bounded boundary %s", lowerBoundary => {
    const result = computeIntegralData({ ...input(slab), lowerBoundary });
    expect(result.status).not.toBe("ok");
    expect(result.value).toBeNaN();
    expect(result.reason).toBeTruthy();
  });
});

describe("closed surface measures", () => {
  it("measures implicit sphere area and volume from the canonical equation", () => {
    const volume = computeIntegralData(input(sphere));
    const area = computeIntegralData(input(sphere, "surfaceArea"));
    expect(volume.status).toBe("ok"); expect(area.status).toBe("ok");
    expect(Math.abs(volume.value / (4 * Math.PI / 3) - 1)).toBeLessThan(.02);
    expect(Math.abs(area.value / (4 * Math.PI) - 1)).toBeLessThan(.02);
    expect(volume.estimatedError).toBeGreaterThan(0);
    const refined = computeIntegralData({ ...input(sphere), quality: "high" });
    expect(Math.abs(refined.value - 4 * Math.PI / 3)).toBeLessThan(Math.abs(volume.value - 4 * Math.PI / 3));
  });
  it("welds periodic parameter seams and sphere poles for enclosed volume", () => {
    const result = computeIntegralData(input(parametricSphere));
    expect(result.status, result.reason ?? "").toBe("ok");
    expect(Math.abs(result.value / (4 * Math.PI / 3) - 1)).toBeLessThan(.01);
  });
  it("preserves parameterized surface-area quadrature", () => {
    expect(computeIntegralData(input(parametricSphere, "surfaceArea")).value).toBeCloseTo(4 * Math.PI, 5);
  });
  it("rejects clipped implicit surfaces and open parameterizations for volume", () => {
    expect(computeIntegralData(input({ ...sphere, domain: { ...sphere.domain, zMin: 0 } }))).toMatchObject({ status: "invalid", reason: expect.stringMatching(/open|clipped/) });
    expect(computeIntegralData(input({ ...parametricSphere, domain: { ...parametricSphere.domain, vMax: Math.PI / 2 } }))).toMatchObject({ status: "invalid", reason: expect.stringMatching(/open|clipped/) });
    expect(computeIntegralData(input({ ...sphere, equation: "x=0" }))).toMatchObject({ status: "invalid" });
    expect(computeIntegralData(input({ ...sphere, equation: "x=0" }, "surfaceArea")).value).toBeCloseTo(16, 5);
  });
});

describe("solid mesh topology", () => {
  const positions = new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]);
  const indices = new Uint16Array([0,2,1, 0,1,3, 0,3,2, 1,2,3]);
  it("computes tetrahedron volume independently of translation and orientation", () => {
    expect(measureSolidMesh({ positions, indices })).toMatchObject({ volume: expect.closeTo(1 / 6, 12), area: expect.closeTo(1.5 + Math.sqrt(3) / 2, 12) });
    const moved = positions.map(value => value + 100000);
    const reversed = indices.slice();
    for (let i = 0; i < reversed.length; i += 3) [reversed[i+1], reversed[i+2]] = [reversed[i+2], reversed[i+1]];
    expect(measureSolidMesh({ positions: moved, indices: reversed })).toMatchObject({ volume: expect.closeTo(1 / 6, 12) });
  });
  it("refuses open, nonmanifold, and inconsistent boundaries", () => {
    expect(measureSolidMesh({ positions, indices: indices.slice(3) })).toHaveProperty("error");
    expect(measureSolidMesh({ positions, indices: Uint16Array.from([...indices, 0,2,1]) })).toHaveProperty("error");
    const inconsistent = indices.slice(); [inconsistent[0], inconsistent[1]] = [inconsistent[1], inconsistent[0]];
    expect(measureSolidMesh({ positions, indices: inconsistent })).toHaveProperty("error");
  });

  it("rejects malformed buffers instead of throwing or returning a partial measure", () => {
    expect(measureSolidMesh({ positions: positions.slice(1), indices })).toHaveProperty("error");
    expect(measureSolidMesh({ positions, indices: indices.slice(1) })).toHaveProperty("error");
    expect(measureSolidMesh({ positions, indices: Uint16Array.of(0, 1, 99) })).toHaveProperty("error");
  });
});
