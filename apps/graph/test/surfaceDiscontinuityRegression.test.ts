import { describe, it, expect } from "vitest";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";
import type { SurfaceDomain } from "@vinculum/scene/types";

// S4: F2 discontinuity-bridging regression tests.
// Primary case tan(x) on ±5 at res 40 (grid step 0.25; columns straddle pi/2
// and -3pi/2 without exact pole hits). Measured pre-fix: full 9600 indices,
// max edge 31.21 (straddle (-4.75, 26.58, -4.75)->(-4.5, -4.64, -5.0)).
// Post-fix (S4-U4 rule): straddling axis edges are cut (320 triangles
// rejected); retained max edge 23.2 comes from valid same-branch approach
// segments at the domain boundary, which the rule correctly keeps.
// Residual diagonal-only bridges are a documented limitation (S4-U3), not a
// separate heuristic in this section.

const DOMAIN: SurfaceDomain = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const RESOLUTION = 40;
const FULL_INDEX_COUNT = RESOLUTION * RESOLUTION * 6;
// No smooth control surface on the res-40 grid exceeds single-unit-scale
// edges; anything far above is a pole bridge, not steep geometry.
const SMOOTH_MAX_EDGE = 6;

interface MeshStats {
  indexCount: number;
  rejectedTriangles: number;
  maxEdge: number;
}

function sampleHeights(
  equation: string,
  domain: SurfaceDomain = DOMAIN,
  resolution: number = RESOLUTION,
  clampHeight = 10_000
) {
  const compiled = compileSurfaceExpression(equation, "z");
  if (compiled.error) {
    throw new Error(`Cannot compile ${equation}: ${compiled.error}`);
  }
  return sampleSurface(compiled.evaluator, {
    domain,
    resolution,
    clampHeight
  });
}

function meshStats(
  equation: string,
  domain: SurfaceDomain = DOMAIN,
  resolution: number = RESOLUTION,
  clampHeight = 10_000
): MeshStats {
  const sampled = sampleHeights(equation, domain, resolution, clampHeight);
  let maxEdge = 0;
  for (let i = 0; i + 2 < sampled.indices.length; i += 3) {
    const corners = [sampled.indices[i] ?? 0, sampled.indices[i + 1] ?? 0, sampled.indices[i + 2] ?? 0].map(
      (vertex) => [
        sampled.positions[vertex * 3] ?? 0,
        sampled.positions[vertex * 3 + 1] ?? 0,
        sampled.positions[vertex * 3 + 2] ?? 0
      ]
    );
    for (let e = 0; e < 3; e += 1) {
      const a = corners[e] ?? [0, 0, 0];
      const b = corners[(e + 1) % 3] ?? [0, 0, 0];
      maxEdge = Math.max(maxEdge, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
  }
  return {
    indexCount: sampled.indices.length,
    rejectedTriangles: sampled.rejectedTriangles,
    maxEdge
  };
}

describe("surface discontinuity regression", () => {
  it("control A: paraboloid keeps every triangle with smooth-scale edges", () => {
    const stats = meshStats("x^2 + y^2");
    expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBe(0);
    expect(stats.maxEdge).toBeLessThan(SMOOTH_MAX_EDGE);
  });

  it("control B: wave keeps every triangle with smooth-scale edges", () => {
    const stats = meshStats("sin(x) * cos(y)");
    expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBe(0);
    expect(stats.maxEdge).toBeLessThan(2);
  });

  it("control C: steep linear surface keeps the full valid mesh", () => {
    const stats = meshStats("100*x");
    expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBe(0);
  });

  it("control D: steep smooth curvature keeps the full valid mesh", () => {
    const stats = meshStats("10*x^2");
    expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBe(0);
  });

  it("control E: saddle keeps the full valid mesh", () => {
    const stats = meshStats("x^2 - y^2");
    expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBe(0);
  });

  it("primary: tan(x) pole bridges are rejected", () => {
    const stats = meshStats("tan(x)");
    // Straddling triangles go (pre-fix: full 9600) while both sides of each
    // pole retain dense valid geometry (8640 indices remain).
    expect(stats.indexCount).toBeLessThan(FULL_INDEX_COUNT);
    expect(stats.indexCount).toBeGreaterThan(0);
    expect(stats.rejectedTriangles).toBeGreaterThan(0);
    // Pre-fix max edge was 31.21 (pole straddle class); retained approach
    // segments and documented diagonal residuals stay below 28.
    expect(stats.maxEdge).toBeLessThan(28);
  });

  it("resolution robustness: tan(x) bridges rejected at res 20 and res 80", () => {
    // Measured pre-fix: res 20 max 16.30, res 80 max 37.99 (full counts).
    // Post-fix: res 20 max 12.56, res 80 max 20.48 (approach-class residuals).
    const low = meshStats("tan(x)", DOMAIN, 20);
    expect(low.indexCount).toBeLessThan(20 * 20 * 6);
    expect(low.rejectedTriangles).toBeGreaterThan(0);
    expect(low.maxEdge).toBeLessThan(15);

    const high = meshStats("tan(x)", DOMAIN, 80);
    expect(high.indexCount).toBeLessThan(80 * 80 * 6);
    expect(high.rejectedTriangles).toBeGreaterThan(0);
    expect(high.maxEdge).toBeLessThan(30);

    const lowControl = meshStats("x^2 + y^2", DOMAIN, 20);
    expect(lowControl.indexCount).toBe(20 * 20 * 6);
    const highControl = meshStats("x^2 + y^2", DOMAIN, 80);
    expect(highControl.indexCount).toBe(80 * 80 * 6);
  });
  it("domain robustness: shifted domain containing tan poles is cut, controls intact", () => {
    const shifted: SurfaceDomain = { xMin: 0, xMax: 10, yMin: -5, yMax: 5 };
    const stats = meshStats("tan(x)", shifted, 40);
    expect(stats.indexCount).toBeLessThan(FULL_INDEX_COUNT);
    expect(stats.rejectedTriangles).toBeGreaterThan(0);
    expect(stats.maxEdge).toBeLessThan(28);

    const control = meshStats("x^2 + y^2", shifted, 40);
    expect(control.indexCount).toBe(FULL_INDEX_COUNT);
    expect(control.rejectedTriangles).toBe(0);
  });

  it("clamp interplay: clamped steep-linear mesh stays whole, clamped pole still cuts", () => {
    // 1000x clamped to ±100 forms flat plateaus (zero jumps): no artificial
    // double-flips can arise from clipping.
    const steep = meshStats("1000*x", DOMAIN, 40, 100);
    expect(steep.indexCount).toBe(FULL_INDEX_COUNT);
    expect(steep.rejectedTriangles).toBe(0);

    // Clamping does not blind the rule: the tan straddle still double-flips.
    const pole = meshStats("tan(x)", DOMAIN, 40, 100);
    expect(pole.indexCount).toBeLessThan(FULL_INDEX_COUNT);
    expect(pole.rejectedTriangles).toBeGreaterThan(0);
  });

  it("orientation invariance: equivalent scalar grids cut identically", () => {
    const compiledZ = compileSurfaceExpression("tan(x)", "z");
    const compiledY = compileSurfaceExpression("tan(x)", "y");
    const compiledX = compileSurfaceExpression("tan(y)", "x");
    expect(compiledZ.error).toBeNull();
    expect(compiledY.error).toBeNull();
    expect(compiledX.error).toBeNull();
    if (compiledZ.error || compiledY.error || compiledX.error) {
      return;
    }
    const options = { domain: DOMAIN, resolution: RESOLUTION, clampHeight: 10_000 };
    const rejectedZ = sampleSurface(compiledZ.evaluator, { ...options, orientation: "z" }).rejectedTriangles;
    const rejectedY = sampleSurface(compiledY.evaluator, { ...options, orientation: "y" }).rejectedTriangles;
    const rejectedX = sampleSurface(compiledX.evaluator, { ...options, orientation: "x" }).rejectedTriangles;
    expect(rejectedZ).toBeGreaterThan(0);
    expect(rejectedY).toBe(rejectedZ);
    expect(rejectedX).toBe(rejectedZ);
  });

  it("pole variety: tan(x*y) bridges reduced without destroying valid sheets", () => {
    const stats = meshStats("tan(x*y)");
    expect(stats.indexCount).toBeLessThan(FULL_INDEX_COUNT);
    expect(stats.indexCount).toBeGreaterThan(0);
    expect(stats.rejectedTriangles).toBeGreaterThan(0);
    // Residual diagonal-only bridges (documented S4-U3 limitation) can remain
    // large; the rule guarantees removal of axis straddles, not a max edge.
  });

  it("pole variety: shifted reciprocal pole is detected (no false negative)", () => {
    // 1/(x - 0.1): single non-periodic pole straddled between the x=0 and
    // x=0.25 columns, never sampled exactly. Compiles (origin probe finite).
    const stats = meshStats("1/(x - 0.1)");
    expect(stats.indexCount).toBeLessThan(FULL_INDEX_COUNT);
    expect(stats.indexCount).toBeGreaterThan(0);
    expect(stats.rejectedTriangles).toBeGreaterThan(0);
  });

  it("anti-false-positive matrix: continuous surfaces keep full meshes", () => {
    for (const equation of ["-100*x", "sin(8*x)*cos(8*y)"]) {
      const stats = meshStats(equation);
      expect(stats.indexCount).toBe(FULL_INDEX_COUNT);
      expect(stats.rejectedTriangles).toBe(0);
    }
  });

  it("mesh index invariants hold after rejection", () => {
    for (const equation of ["tan(x)", "x^2 + y^2"]) {
      const sampled = sampleHeights(equation);
      const vertexCount = (RESOLUTION + 1) * (RESOLUTION + 1);
      expect(sampled.indices.length % 3).toBe(0);
      for (let i = 0; i < sampled.indices.length; i += 1) {
        expect(sampled.indices[i]).toBeLessThan(vertexCount);
      }
    }
  });
});
