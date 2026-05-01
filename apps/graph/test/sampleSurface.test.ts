import { describe, it, expect } from "vitest";
import { sampleSurface } from "@/lib/math/sampleSurface";
import type { SurfaceEvaluator } from "@/lib/math/compileExpression";
import type { SurfaceDomain } from "@vinculum/scene/types";

describe("sampleSurface", () => {
  const mockEvaluator: SurfaceEvaluator = (x: number, y: number) => x + y;

  it("caps resolution at 128 per normalizeSurfaceResolution", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      resolution: 255
    });

    const maxVertices = 129 * 129;
    expect(result.positions.length).toBeLessThanOrEqual(maxVertices * 3);
    expect(result.positions.length).toBe(129 * 129 * 3);
  });

  it("completes at max normalized resolution without throwing", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      resolution: 128
    });

    expect(result.positions.length).toBe(129 * 129 * 3);
  });

  it("swaps reversed xMin/xMax", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: 10, xMax: -10, yMin: -5, yMax: 5 },
      resolution: 10
    });

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions.length).toBe(11 * 11 * 3);
  });

  it("swaps reversed yMin/yMax", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: -5, xMax: 5, yMin: 10, yMax: -10 },
      resolution: 10
    });

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions.length).toBe(11 * 11 * 3);
  });

  it("produces finite positions", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 10
    });

    for (let i = 0; i < result.positions.length; i++) {
      expect(Number.isFinite(result.positions[i])).toBe(true);
    }
  });

  it("maps NaN evaluator heights to invalidHeight and drops indices", () => {
    const nanEvaluator: SurfaceEvaluator = () => Number.NaN;

    const result = sampleSurface(nanEvaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 5,
      invalidHeight: 0
    });

    for (let i = 1; i < result.positions.length; i += 3) {
      expect(result.positions[i]).toBe(0);
    }

    expect(result.indices.length).toBe(0);
  });

  it("clamps infinite evaluator output when clampHeight is set", () => {
    const infEvaluator: SurfaceEvaluator = () => Number.POSITIVE_INFINITY;

    const result = sampleSurface(infEvaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 5,
      clampHeight: 100
    });

    for (let i = 2; i < result.positions.length; i += 3) {
      expect(Math.abs(result.positions[i])).toBeLessThanOrEqual(100);
    }
  });

  it("triangulates with a bounded index count", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 10
    });

    const expectedIndices = 10 * 10 * 6;
    expect(result.indices.length).toBeLessThanOrEqual(expectedIndices);
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("keeps vertex order consistent for small grids", () => {
    const result = sampleSurface(mockEvaluator, {
      domain: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      resolution: 2
    });

    expect(result.positions.length).toBe(3 * 3 * 3);
    expect(result.indices.length).toBeGreaterThan(0);
    expect(result.indices.length).toBeLessThanOrEqual(2 * 2 * 6);

    if (result.indices.length >= 3) {
      expect(result.indices[0]).toBeLessThan(9);
      expect(result.indices[1]).toBeLessThan(9);
      expect(result.indices[2]).toBeLessThan(9);
    }
  });

  it("maps constant surfaces to the correct world axis for x/y/z orientations", () => {
    const constEval: SurfaceEvaluator = () => 3;
    const domain: SurfaceDomain = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };

    const zx = sampleSurface(constEval, { domain, resolution: 2, orientation: "x" });
    expect(zx.positions[0]).toBeCloseTo(3, 6);

    const zy = sampleSurface(constEval, { domain, resolution: 2, orientation: "y" });
    expect(zy.positions[2]).toBeCloseTo(3, 6);

    const zz = sampleSurface(constEval, { domain, resolution: 2, orientation: "z" });
    expect(zz.positions[1]).toBeCloseTo(3, 6);
  });
});
