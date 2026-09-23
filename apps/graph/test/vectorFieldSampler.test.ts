import { describe, expect, it } from "vitest";
import { computeVectorFieldData } from "@/lib/math/computeVectorFieldData";

const DOMAIN_2D = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const DOMAIN_3D = { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 };

describe("computeVectorFieldData (S20 Slice 2)", () => {
  it("samples 2D radial with exact counts and endpoint inclusion", () => {
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "",
      domain: DOMAIN_2D,
      density: 10,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.totalSamples).toBe(100);
    expect(result.validCount).toBe(100);
    expect(result.invalidCount).toBe(0);
    expect(result.positions).toHaveLength(300);
    expect(result.vectors).toHaveLength(300);
    expect(result.magnitudes).toHaveLength(100);
    // First sample at the domain corner, vector equals position (radial).
    expect(result.positions[0]).toBe(-5);
    expect(result.positions[1]).toBe(-5);
    expect(result.vectors[0]).toBe(-5);
    expect(result.vectors[1]).toBe(-5);
    // Last sample at the opposite corner.
    expect(result.positions[297]).toBe(5);
    expect(result.positions[298]).toBe(5);
    // Corner magnitude sqrt(50) (Float32 buffer precision).
    expect(result.magnitudes[0]).toBeCloseTo(Math.sqrt(50), 6);
    expect(result.maxMagnitude).toBeCloseTo(Math.sqrt(50), 6);
  });

  it("samples 3D nonlinear with exact counts", () => {
    const result = computeVectorFieldData({
      dimension: "3d",
      pExpr: "sin(y)",
      qExpr: "sin(z)",
      rExpr: "sin(x)",
      domain: DOMAIN_3D,
      density: 4,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.totalSamples).toBe(64);
    expect(result.validCount).toBe(64);
    expect(result.positions).toHaveLength(192);
    expect(result.vectors).toHaveLength(192);
    // sin is bounded: every magnitude is finite and within sqrt(3).
    for (const magnitude of result.magnitudes) {
      expect(Number.isFinite(magnitude)).toBe(true);
      expect(magnitude).toBeLessThanOrEqual(Math.sqrt(3) + 1e-9);
    }
  });

  it("marks x=0 samples invalid for P=1/x while others survive, with no NaN transfer", () => {
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "1/x",
      qExpr: "y",
      rExpr: "",
      domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1 },
      density: 5,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // 5 x-positions (-2,-1,0,1,2) x 5 y-positions: the x=0 column (5) invalid.
    expect(result.totalSamples).toBe(25);
    expect(result.invalidCount).toBe(5);
    expect(result.validCount).toBe(20);
    for (const value of [...result.positions, ...result.vectors, ...result.magnitudes]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("keeps zero vectors valid with magnitude 0", () => {
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "0",
      qExpr: "0",
      rExpr: "",
      domain: DOMAIN_2D,
      density: 4,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.validCount).toBe(16);
    expect(result.maxMagnitude).toBe(0);
    for (const magnitude of result.magnitudes) {
      expect(magnitude).toBe(0);
    }
  });

  it("records large-but-finite magnitudes without capping (renderer caps length)", () => {
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "1e8 * x",
      qExpr: "y",
      rExpr: "",
      domain: DOMAIN_2D,
      density: 4,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.validCount).toBe(16);
    expect(Number.isFinite(result.maxMagnitude)).toBe(true);
    // Float32 buffers: assert relative tolerance, not decimal precision.
    expect(Math.abs(result.maxMagnitude - 5e8) / 5e8).toBeLessThan(1e-6);
  });

  it("drops magnitude-overflow samples instead of transferring Infinity", () => {
    // P = exp(1000*x) over x in {-2, 0, 2}: underflows to 0, evaluates to
    // 1, and overflows to Infinity respectively. Only the overflow column
    // drops; buffers stay finite.
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "exp(1000*x)",
      qExpr: "y",
      rExpr: "",
      domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1 },
      density: 3,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.totalSamples).toBe(9);
    expect(result.invalidCount).toBe(3);
    expect(result.validCount).toBe(6);
    for (const value of [...result.positions, ...result.vectors, ...result.magnitudes]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("returns empty when every sample is invalid", () => {
    const result = computeVectorFieldData({
      dimension: "2d",
      pExpr: "log(x)",
      qExpr: "log(y)",
      rExpr: "",
      domain: { xMin: -2, xMax: -1, yMin: -2, yMax: -1 },
      density: 3,
      params: {}
    });
    expect(result.status).toBe("empty");
  });

  it("returns error for compile failures and bad densities", () => {
    const badMath = computeVectorFieldData({
      dimension: "2d",
      pExpr: "zzz",
      qExpr: "y",
      rExpr: "",
      domain: DOMAIN_2D,
      density: 4,
      params: {}
    });
    expect(badMath.status).toBe("error");

    for (const density of [0, 1, 33]) {
      const bad = computeVectorFieldData({
        dimension: "2d",
        pExpr: "x",
        qExpr: "y",
        rExpr: "",
        domain: DOMAIN_2D,
        density,
        params: {}
      });
      expect(bad.status).toBe("error");
    }
    const bad3D = computeVectorFieldData({
      dimension: "3d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "z",
      domain: DOMAIN_3D,
      density: 13,
      params: {}
    });
    expect(bad3D.status).toBe("error");
  });

  it("stays finite on degenerate and inverted domains", () => {
    const degenerate = computeVectorFieldData({
      dimension: "2d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "",
      domain: { xMin: 2, xMax: 2, yMin: 2, yMax: 2 },
      density: 3,
      params: {}
    });
    expect(degenerate.status).toBe("ok");
    if (degenerate.status !== "ok") return;
    for (const value of [...degenerate.positions, ...degenerate.vectors, ...degenerate.magnitudes]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    const inverted = computeVectorFieldData({
      dimension: "3d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "z",
      domain: { xMin: 1, xMax: -1, yMin: 1, yMax: -1, zMin: 1, zMax: -1 },
      density: 2,
      params: {}
    });
    expect(inverted.status).toBe("ok");
    if (inverted.status !== "ok") return;
    for (const value of [...inverted.positions, ...inverted.vectors, ...inverted.magnitudes]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("threads parameters into sampling", () => {
    const result = computeVectorFieldData({
      dimension: "3d",
      pExpr: "a*x",
      qExpr: "y",
      rExpr: "z",
      domain: DOMAIN_3D,
      density: 2,
      params: { a: 2 }
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // First sample at (-4,-4,-4): P = 2*-4.
    expect(result.vectors[0]).toBe(-8);
  });
});
