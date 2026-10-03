import { describe, it, expect } from "vitest";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions, type ParametricEvaluator } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { sampleSurface } from "@/lib/math/sampleSurface";

// S1-U4: discontinuity/triangle analysis (diagnostic-only, characterization).
// Measures whether sampling across singularities produces false/stretched
// triangles and gap-spanning chords. No fixes, no adaptive meshing.

const DOMAIN = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const RESOLUTION = 40;

function maxTriangleEdgeLength(positions: Float32Array, indices: Uint16Array): number {
  let maxEdge = 0;
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const corners = [indices[i] ?? 0, indices[i + 1] ?? 0, indices[i + 2] ?? 0].map((vertex) => [
      positions[vertex * 3] ?? 0,
      positions[vertex * 3 + 1] ?? 0,
      positions[vertex * 3 + 2] ?? 0
    ]);
    for (let e = 0; e < 3; e += 1) {
      const a = corners[e] ?? [0, 0, 0];
      const b = corners[(e + 1) % 3] ?? [0, 0, 0];
      maxEdge = Math.max(maxEdge, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
  }
  return maxEdge;
}

function countLongEdges(positions: Float32Array, indices: Uint16Array, threshold: number): number {
  let count = 0;
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const corners = [indices[i] ?? 0, indices[i + 1] ?? 0, indices[i + 2] ?? 0].map((vertex) => [
      positions[vertex * 3] ?? 0,
      positions[vertex * 3 + 1] ?? 0,
      positions[vertex * 3 + 2] ?? 0
    ]);
    for (let e = 0; e < 3; e += 1) {
      const a = corners[e] ?? [0, 0, 0];
      const b = corners[(e + 1) % 3] ?? [0, 0, 0];
      if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > threshold) {
        count += 1;
      }
    }
  }
  return count;
}

describe("surface discontinuity analysis", () => {
  it("keeps smooth-surface triangle edges near grid scale", () => {
    const compiled = compileSurfaceExpression("x^2 + y^2", "z");
    expect(compiled.error).toBeNull();
    const sampled = sampleSurface(compiled.evaluator, { domain: DOMAIN, resolution: RESOLUTION });

    // Grid step is 0.25; even the steepest corner diagonal (gradient ~14 over
    // a 0.35 run) stays at single-unit scale. Measured 4.89 on this grid.
    expect(maxTriangleEdgeLength(sampled.positions, sampled.indices)).toBeLessThan(6);
    expect(countLongEdges(sampled.positions, sampled.indices, 5)).toBe(0);
  });

  it("cuts tan(x) pole straddles instead of spanning them (S4 F2 fix)", () => {
    const compiled = compileSurfaceExpression("tan(x)", "z");
    expect(compiled.error).toBeNull();
    const sampled = sampleSurface(compiled.evaluator, {
      domain: DOMAIN,
      resolution: RESOLUTION,
      clampHeight: 10_000
    });

    // Poles at x = +/-pi/2 cut the mesh: the pre-fix 31.21 straddle class is
    // gone (retained max 23.2 comes from valid same-branch approach segments
    // plus the documented diagonal limitation). Detailed bounds live in
    // surfaceDiscontinuityRegression.test.ts.
    expect(sampled.indices.length).toBeLessThan(RESOLUTION * RESOLUTION * 6);
    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.rejectedTriangles).toBeGreaterThan(0);
    expect(maxTriangleEdgeLength(sampled.positions, sampled.indices)).toBeLessThan(28);
  });

  it("draws a straight chord across parametric gaps instead of breaking the line", () => {
    const compiled = compileParametricExpressions("t", "t", "t");
    expect(compiled.error).toBeNull();
    const gapEvaluator: ParametricEvaluator = (t) => {
      if (t > 0.4 && t < 0.6) {
        return [Number.NaN, Number.NaN, Number.NaN];
      }
      return compiled.evaluator(t);
    };

    const sampled = sampleCurve(gapEvaluator, { tMin: 0, tMax: 1, samples: 101 });
    const step = (i: number) =>
      Math.hypot(
        (sampled.positions[3 * (i + 1)] ?? 0) - (sampled.positions[3 * i] ?? 0),
        (sampled.positions[3 * (i + 1) + 1] ?? 0) - (sampled.positions[3 * i + 1] ?? 0),
        (sampled.positions[3 * (i + 1) + 2] ?? 0) - (sampled.positions[3 * i + 2] ?? 0)
      );

    const normalStep = step(0);
    let maxStep = 0;
    for (let i = 0; i < 100; i += 1) {
      maxStep = Math.max(maxStep, step(i));
    }

    // One chord jumps the whole gap; normal steps are ~0.017.
    expect(normalStep).toBeGreaterThan(0);
    expect(maxStep).toBeGreaterThan(10 * normalStep);
  });
});
