import { describe, it, expect } from "vitest";
import { compileSurfaceExpression, type SurfaceEvaluator } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import { sampleSurface } from "@/lib/math/sampleSurface";

// S1-U2: end-to-end pipeline regression cases (safety -> compile -> sample).
// These tests characterize CURRENT behavior, including known weaknesses, so
// future repairs can be measured against them. They must pass without any
// production behavior change.

const DOMAIN = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const RESOLUTION = 40;
const STRIDE = RESOLUTION + 1;
const FULL_INDEX_COUNT = RESOLUTION * RESOLUTION * 6;

function worldHeights(positions: Float32Array): number[] {
  const heights: number[] = [];
  for (let i = 1; i < positions.length; i += 3) {
    heights.push(positions[i] ?? Number.NaN);
  }
  return heights;
}

describe("surface pipeline regression", () => {
  it("renders z = x^2 + y^2 as a non-negative bowl centered at the origin", () => {
    const compiled = compileSurfaceExpression("x^2 + y^2", "z");
    expect(compiled.error).toBeNull();
    expect(compiled.effectiveOrientation).toBe("z");

    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: RESOLUTION });
    expect(sampled.indices.length).toBe(FULL_INDEX_COUNT);

    const heights = worldHeights(sampled.positions);
    expect(heights.every(Number.isFinite)).toBe(true);
    expect(Math.min(...heights)).toBeCloseTo(0, 9);
    expect(Math.max(...heights)).toBeCloseTo(50, 9);

    const centerIndex = 20 * STRIDE + 20;
    expect(sampled.positions[centerIndex * 3]).toBeCloseTo(0, 9);
    expect(sampled.positions[centerIndex * 3 + 1]).toBeCloseTo(0, 9);
    expect(sampled.positions[centerIndex * 3 + 2]).toBeCloseTo(0, 9);
  });

  it("renders z = x^2 - y^2 as a saddle spanning negative and positive heights", () => {
    const compiled = compileSurfaceExpression("x^2 - y^2", "z");
    expect(compiled.error).toBeNull();

    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: RESOLUTION });
    expect(sampled.indices.length).toBe(FULL_INDEX_COUNT);

    const heights = worldHeights(sampled.positions);
    expect(Math.min(...heights)).toBeLessThan(0);
    expect(Math.max(...heights)).toBeGreaterThan(0);
  });

  it("renders z = sin(x) * cos(y) bounded by [-1, 1]", () => {
    const compiled = compileSurfaceExpression("sin(x) * cos(y)", "z");
    expect(compiled.error).toBeNull();

    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: RESOLUTION });
    expect(sampled.indices.length).toBe(FULL_INDEX_COUNT);

    for (const height of worldHeights(sampled.positions)) {
      expect(Math.abs(height)).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  it("renders z = sin(sqrt(x^2+y^2)) finite everywhere with zero center height", () => {
    const compiled = compileSurfaceExpression("sin(sqrt(x^2+y^2))", "z");
    expect(compiled.error).toBeNull();

    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: RESOLUTION });
    expect(sampled.indices.length).toBe(FULL_INDEX_COUNT);

    const heights = worldHeights(sampled.positions);
    expect(heights.every(Number.isFinite)).toBe(true);

    const centerIndex = 20 * STRIDE + 20;
    expect(sampled.positions[centerIndex * 3 + 1]).toBeCloseTo(0, 9);
  });

  it("rejects z = 1/(x^2+y^2) at compile time because the (0,0) probe is singular", () => {
    const compiled = compileSurfaceExpression("1/(x^2+y^2)", "z");
    expect(compiled.error).not.toBeNull();
  });

  it("excludes singular vertices from indices at the sampler level", () => {
    const singularEvaluator: SurfaceEvaluator = (u, v) => {
      const denominator = u * u + v * v;
      if (denominator === 0) {
        return Number.NaN;
      }
      const value = 1 / denominator;
      return Number.isFinite(value) ? value : Number.NaN;
    };

    const sampled = sampleSurface(singularEvaluator, {
      domain: DOMAIN,
      resolution: RESOLUTION,
      invalidHeight: 0,
      clampHeight: 10_000
    });

    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.indices.length).toBeLessThan(FULL_INDEX_COUNT);
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }

    const centerIndex = 20 * STRIDE + 20;
    expect(Array.from(sampled.indices)).not.toContain(centerIndex);
  });

  it("renders z = tan(x*y) with pole bridges cut (S4 F2 fix; see S1-U4 note)", () => {
    const compiled = compileSurfaceExpression("tan(x*y)", "z");
    expect(compiled.error).toBeNull();

    const sampled = sampleSurface(compiled.evaluator, {
      domain: DOMAIN,
      resolution: RESOLUTION,
      clampHeight: 10_000
    });
    // Pole branches cut the mesh instead of bridging across asymptotes,
    // while valid sheets on all sides are retained.
    expect(sampled.indices.length).toBeLessThan(FULL_INDEX_COUNT);
    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.rejectedTriangles).toBeGreaterThan(0);

    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }
  });

  it("renders the parametric helix as a finite non-degenerate world-space line", () => {
    const compiled = compileParametricExpressions("cos(t)", "sin(t)", "t / 3");
    expect(compiled.error).toBeNull();

    const sampled = sampleCurve(compiled.evaluator, {
      tMin: 0,
      tMax: 6 * Math.PI,
      samples: 300,
      clampCoordinate: 10_000
    });
    expect(sampled.positions.length).toBe(300 * 3);
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }

    expect(sampled.positions[0]).toBeCloseTo(1, 6);
    expect(sampled.positions[1]).toBeCloseTo(0, 6);
    expect(sampled.positions[2]).toBeCloseTo(0, 6);

    for (let i = 3; i < sampled.positions.length; i += 3) {
      expect(sampled.positions[i + 1] ?? 0).toBeGreaterThanOrEqual((sampled.positions[i - 2] ?? 0) - 1e-9);
    }
  });

  it("extracts plane coefficients for x + 2y + z - 3 and meshes vertices on the plane", () => {
    const compiled = compilePlaneEquation("x + 2y + z - 3");
    expect(compiled.error).toBeNull();
    expect(compiled.coefficients).toMatchObject({ a: 1, b: 2, c: 1, d: -3 });

    const sampled = samplePlane(compiled.coefficients ?? { a: 1, b: 2, c: 1, d: -3 }, 12);
    expect(sampled.positions.length).toBe(12);
    expect(Array.from(sampled.indices)).toEqual([0, 1, 2, 0, 2, 3]);

    for (let i = 0; i < sampled.positions.length; i += 3) {
      const x = sampled.positions[i] ?? 0;
      const y = sampled.positions[i + 1] ?? 0;
      const z = sampled.positions[i + 2] ?? 0;
      expect(x + 2 * y + z).toBeCloseTo(3, 6);
    }
  });
});
