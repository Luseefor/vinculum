import { describe, expect, it } from "vitest";
import {
  computeScalarFieldData,
  DEFAULT_SCALAR_GRADIENT_DENSITY
} from "@/lib/math/computeScalarFieldData";

const BOWL = "x^2 + y^2";

describe("computeScalarFieldData explicit sources (S23 PART 11/13)", () => {
  it("samples f=x^2+y^2 with stats, levels, circular contours, and gradient", () => {
    const result = computeScalarFieldData({
      source: { kind: "surface", equation: `z = ${BOWL}`, orientation: "z" },
      target: { kind: "domain2D", domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 } },
      resolution: 64,
      contourCount: 8,
      gradientDensity: DEFAULT_SCALAR_GRADIENT_DENSITY,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.width).toBe(65);
    expect(result.min).toBeCloseTo(0, 8);
    expect(result.max).toBeCloseTo(50, 8);
    expect(result.levels).toHaveLength(8);
    expect(result.contourStatus).toBe("ok");
    expect(result.contourSegmentCount).toBeGreaterThan(50);
    // For f=x^2+y^2 the analytic gradient is exactly 2*position:
    // every sampled vector must match its base point (stronger than a
    // single-point check, and independent of grid alignment).
    expect(result.gradientStatus).toBe("ok");
    expect(result.gradientMaxMagnitude).toBeGreaterThan(0);
    for (let i = 0; i < result.gradientValidCount; i += 1) {
      const px = result.gradientPositions[i * 3] as number;
      const py = result.gradientPositions[i * 3 + 1] as number;
      expect(result.gradientVectors[i * 3]).toBeCloseTo(2 * px, 8);
      expect(result.gradientVectors[i * 3 + 1]).toBeCloseTo(2 * py, 8);
    }
  });

  it("pins f=x^2+2y^2 gradient <2,8> at (1,2)", () => {
    const result = computeScalarFieldData({
      source: { kind: "surface", equation: "z = x^2 + 2*y^2", orientation: "z" },
      target: { kind: "domain2D", domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 } },
      resolution: 16,
      contourCount: 0,
      gradientDensity: 11,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    // 11 nodes over [-5,5] land exactly on integers, including (1,2).
    let found = false;
    for (let i = 0; i < result.gradientValidCount; i += 1) {
      if (
        result.gradientPositions[i * 3] === 1 &&
        result.gradientPositions[i * 3 + 1] === 2
      ) {
        expect(result.gradientVectors[i * 3]).toBeCloseTo(2, 10);
        expect(result.gradientVectors[i * 3 + 1]).toBeCloseTo(8, 10);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("maps independent variables per orientation (never hardcoded x/y)", () => {
    const xOriented = computeScalarFieldData({
      source: { kind: "surface", equation: "x = y^2 + 3*z", orientation: "x" },
      target: { kind: "domain2D", domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 } },
      resolution: 8,
      contourCount: 0,
      gradientDensity: 5,
      params: {}
    });
    expect(xOriented.status).toBe("ok");
    if (xOriented.status !== "ok") {
      return;
    }
    // f(y,z) = y^2+3z at (y=2,z=1) is 7; gradient is <4,3>.
    expect(xOriented.min).toBeLessThan(7);
    expect(xOriented.max).toBeGreaterThanOrEqual(7);
    let found = false;
    for (let i = 0; i < xOriented.gradientValidCount; i += 1) {
      if (
        xOriented.gradientPositions[i * 3] === 2 &&
        xOriented.gradientPositions[i * 3 + 1] === 1
      ) {
        expect(xOriented.gradientVectors[i * 3]).toBeCloseTo(4, 10);
        expect(xOriented.gradientVectors[i * 3 + 1]).toBeCloseTo(3, 10);
        found = true;
      }
    }
    expect(found).toBe(true);

    const yOriented = computeScalarFieldData({
      source: { kind: "surface", equation: "y = x + 2*z", orientation: "y" },
      target: { kind: "domain2D", domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 } },
      resolution: 8,
      contourCount: 0,
      gradientDensity: 0,
      params: {}
    });
    expect(yOriented.status).toBe("ok");
    if (yOriented.status !== "ok") {
      return;
    }
    expect(yOriented.gradientStatus).toBe("skipped");
    // f(x,z) = x+2z over [-2,2]^2 spans [-6,6].
    expect(yOriented.min).toBeCloseTo(-6, 8);
    expect(yOriented.max).toBeCloseTo(6, 8);
  });

  it("keeps heat/contours while reporting unavailable gradients (PART 42)", () => {
    // tan differentiates to sec (unsupported) but samples safely.
    const result = computeScalarFieldData({
      source: { kind: "surface", equation: "z = tan(x) + y", orientation: "z" },
      target: { kind: "domain2D", domain: { uMin: -1, uMax: 1, vMin: -1, vMax: 1 } },
      resolution: 32,
      contourCount: 6,
      gradientDensity: 8,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.validCount).toBeGreaterThan(0);
    expect(result.gradientStatus).toBe("unavailable");
    expect(result.gradientValidCount).toBe(0);
  });

  it("shares the canonical S11 scope policy including t (S23-R1)", () => {
    // compileSurfaceExpression seeds {x,y,z,t,pi,e} defaults; the scalar
    // sampler must agree (a t-expression renders in 3D, so heat must too).
    const result = computeScalarFieldData({
      source: { kind: "surface", equation: "z = x + t", orientation: "z" },
      target: { kind: "domain2D", domain: { uMin: 1, uMax: 3, vMin: 0, vMax: 0 } },
      resolution: 8,
      contourCount: 0,
      gradientDensity: 0,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    // t defaults to 0: values equal x.
    expect(result.min).toBeCloseTo(1, 10);
    expect(result.max).toBeCloseTo(3, 10);
  });

  it("rejects mismatched source/target pairs cleanly", () => {
    expect(
      computeScalarFieldData({
        source: { kind: "surface", equation: "z = x + y", orientation: "z" },
        target: { kind: "slice", plane: "xy", planeValue: 0, domain: { uMin: -1, uMax: 1, vMin: -1, vMax: 1 } },
        resolution: 16,
        contourCount: 4,
        gradientDensity: 0,
        params: {}
      }).status
    ).toBe("error");
    expect(
      computeScalarFieldData({
        source: { kind: "implicit", equation: "x^2+y^2+z^2-1" },
        target: { kind: "domain2D", domain: { uMin: -1, uMax: 1, vMin: -1, vMax: 1 } },
        resolution: 16,
        contourCount: 4,
        gradientDensity: 0,
        params: {}
      }).status
    ).toBe("error");
  });
});

describe("computeScalarFieldData slice targets (S23 PART 11)", () => {
  it("pins the asymmetric plane F=x+2y+3z on all three planes", () => {
    const equation = "x + 2*y + 3*z";
    const check = (
      plane: "xy" | "xz" | "yz",
      planeValue: number,
      expected: (u: number, v: number) => number
    ) => {
      const result = computeScalarFieldData({
        source: { kind: "implicit", equation },
        target: { kind: "slice", plane, planeValue, domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 } },
        resolution: 8,
        contourCount: 0,
        gradientDensity: 0,
        params: {}
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") {
        return;
      }
      expect(result.gradientStatus).toBe("skipped");
      for (let j = 0; j < result.height; j += 1) {
        for (let i = 0; i < result.width; i += 1) {
          const index = j * result.width + i;
          const u = -2 + (i * 4) / 8;
          const v = -2 + (j * 4) / 8;
          expect(result.valid[index]).toBe(1);
          expect(result.values[index]).toBeCloseTo(expected(u, v), 8);
        }
      }
    };
    // XY at z=4: x+2y+12. XZ at y=5: x+10+3z. YZ at x=6: 6+2y+3z.
    check("xy", 4, (u, v) => u + 2 * v + 12);
    check("xz", 5, (u, v) => u + 10 + 3 * v);
    check("yz", 6, (u, v) => 6 + 2 * u + 3 * v);
  });

  it("slices the unit sphere with radial heat and a unit zero contour", () => {
    const result = computeScalarFieldData({
      source: { kind: "implicit", equation: "x^2+y^2+z^2-1" },
      target: { kind: "slice", plane: "xy", planeValue: 0, domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 } },
      resolution: 64,
      contourCount: 8,
      gradientDensity: 0,
      params: {}
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    // Center F=-1, corner F=7: radial heat.
    expect(result.min).toBeCloseTo(-1, 6);
    expect(result.max).toBeCloseTo(7, 6);
    // Zero contour present and circular at radius ~= 1.
    expect(result.contourStatus).toBe("ok");
    let worstRadius = 0;
    let zeroPoints = 0;
    for (let s = 0; s < result.contourSegmentCount * 4; s += 2) {
      const x = result.contourSegments[s] as number;
      const y = result.contourSegments[s + 1] as number;
      const radius = Math.sqrt(x * x + y * y);
      // Only the zero level sits near radius 1 (other levels differ).
      if (Math.abs(radius - 1) < 0.2) {
        zeroPoints += 1;
        worstRadius = Math.max(worstRadius, Math.abs(radius - 1));
      }
    }
    expect(zeroPoints).toBeGreaterThan(20);
    expect(worstRadius).toBeLessThan(0.1);
  });
});
