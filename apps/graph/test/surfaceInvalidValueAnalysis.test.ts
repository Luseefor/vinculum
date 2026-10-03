import { describe, it, expect } from "vitest";
import type { SurfaceEvaluator } from "@/lib/math/compileExpression";
import type { ParametricEvaluator } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { sampleSurface } from "@/lib/math/sampleSurface";

// S1-U3: invalid-value analysis (diagnostic-only, characterization of current behavior).
// Documents what the sampler does with NaN / Infinity / undefined / huge finite
// values: which vertices enter the position buffer and which get indexed.

const DOMAIN = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const RESOLUTION = 40;
const STRIDE = RESOLUTION + 1;

describe("surface invalid-value analysis", () => {
  it("places NaN vertices in the position buffer at invalidHeight but never indexes them", () => {
    const sentinel = -99999;
    const diskEvaluator: SurfaceEvaluator = (u, v) => (u * u + v * v < 1 ? Number.NaN : u * u + v * v);

    const sampled = sampleSurface(diskEvaluator, {
      domain: DOMAIN,
      resolution: RESOLUTION,
      invalidHeight: sentinel,
      clampHeight: 10_000
    });

    const heights: number[] = [];
    for (let i = 1; i < sampled.positions.length; i += 3) {
      heights.push(sampled.positions[i] ?? Number.NaN);
    }
    // Invalid vertices ARE present in the buffer (affects bounding volumes).
    expect(heights).toContain(sentinel);

    const indexed = new Set<number>(sampled.indices);
    for (let vertex = 0; vertex < heights.length; vertex += 1) {
      if (heights[vertex] === sentinel) {
        expect(indexed.has(vertex)).toBe(false);
      }
    }
    expect(sampled.indices.length).toBeGreaterThan(0);
  });

  it("treats +Infinity and -Infinity as invalid, not as clamped extremes", () => {
    const infEvaluator: SurfaceEvaluator = () => Number.POSITIVE_INFINITY;
    const negInfEvaluator: SurfaceEvaluator = () => Number.NEGATIVE_INFINITY;

    for (const evaluator of [infEvaluator, negInfEvaluator]) {
      const sampled = sampleSurface(evaluator, {
        domain: DOMAIN,
        resolution: RESOLUTION,
        invalidHeight: 0,
        clampHeight: 100
      });
      expect(sampled.indices.length).toBe(0);
      for (let i = 1; i < sampled.positions.length; i += 3) {
        expect(sampled.positions[i]).toBe(0);
      }
    }
  });

  it("treats undefined evaluator output as invalid", () => {
    const undefinedEvaluator = (() => undefined) as unknown as SurfaceEvaluator;
    const sampled = sampleSurface(undefinedEvaluator, {
      domain: DOMAIN,
      resolution: 5,
      invalidHeight: 0
    });
    expect(sampled.indices.length).toBe(0);
  });

  it("clamps very large finite values to +/-clampHeight and keeps them indexed", () => {
    const hugeEvaluator: SurfaceEvaluator = () => 1e300;
    const sampled = sampleSurface(hugeEvaluator, {
      domain: DOMAIN,
      resolution: 5,
      clampHeight: 100
    });

    expect(sampled.indices.length).toBeGreaterThan(0);
    for (let i = 1; i < sampled.positions.length; i += 3) {
      expect(sampled.positions[i]).toBe(100);
    }
  });

  it("bridges parametric gaps by repeating the previous finite point", () => {
    const gappedEvaluator: ParametricEvaluator = (t) => {
      if (t > 0.4 && t < 0.6) {
        return [Number.NaN, Number.NaN, Number.NaN];
      }
      return [t, t, t];
    };

    const sampled = sampleCurve(gappedEvaluator, { tMin: 0, tMax: 1, samples: 101 });
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }

    let repeatedRuns = 0;
    for (let i = 3; i < sampled.positions.length; i += 3) {
      const same =
        sampled.positions[i] === sampled.positions[i - 3] &&
        sampled.positions[i + 1] === sampled.positions[i - 2] &&
        sampled.positions[i + 2] === sampled.positions[i - 1];
      if (same) {
        repeatedRuns += 1;
      }
    }
    // Gap samples collapse onto the last finite point instead of breaking the line.
    expect(repeatedRuns).toBeGreaterThan(0);
  });

  it("keeps invalid surface vertices inside the vertex grid addressing (stride intact)", () => {
    const halfInvalid: SurfaceEvaluator = (u) => (u < 0 ? Number.NaN : u);
    const sampled = sampleSurface(halfInvalid, {
      domain: DOMAIN,
      resolution: RESOLUTION,
      invalidHeight: 0
    });

    // Full grid is still allocated; only indexing is sparse.
    expect(sampled.positions.length).toBe(STRIDE * STRIDE * 3);
    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.indices.length).toBeLessThan(RESOLUTION * RESOLUTION * 6);
    for (const index of sampled.indices) {
      expect(index).toBeLessThan(STRIDE * STRIDE);
    }
  });
});
