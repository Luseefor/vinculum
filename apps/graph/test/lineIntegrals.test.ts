import { describe, expect, it } from "vitest";
import { compileCurveGeometry } from "@/lib/math/curveGeometry";
import { arcLength, scalarLineIntegral, workIntegral } from "@/lib/math/lineIntegrals";

const LINE = { tMin: 0, tMax: 1 };
const CIRCLE = { tMin: 0, tMax: 2 * Math.PI };

function circle() {
  return compileCurveGeometry("cos(t)", "sin(t)", "0", {});
}

describe("arc length (S25 PART 6)", () => {
  it("measures r=<t,0,0> over [0,3] as 3", () => {
    const geometry = compileCurveGeometry("t", "0", "0", {});
    const result = arcLength(geometry, { tMin: 0, tMax: 3 }, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(3, 10);
    expect(result.estimatedError).toBeLessThan(1e-9);
  });

  it("measures the unit circle as 2*pi at every quality", () => {
    for (const quality of ["low", "medium", "high"] as const) {
      const result = arcLength(circle(), CIRCLE, quality);
      expect(result.status).toBe("ok");
      expect(result.value).toBeCloseTo(2 * Math.PI, quality === "low" ? 4 : 6);
    }
  });

  it("measures the helix as 2*pi*sqrt(2)", () => {
    const geometry = compileCurveGeometry("cos(t)", "sin(t)", "t", {});
    const result = arcLength(geometry, CIRCLE, "high");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(2 * Math.PI * Math.SQRT2, 6);
  });

  it("negates over inverted domains (signed Simpson convention)", () => {
    const geometry = compileCurveGeometry("t", "0", "0", {});
    const result = arcLength(geometry, { tMin: 1, tMax: 0 }, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(-1, 10);
  });

  it("reports unsupported when derivatives are unavailable", () => {
    const geometry = compileCurveGeometry("tan(t)", "t", "0", {});
    const result = arcLength(geometry, LINE, "medium");
    expect(result.status).toBe("unsupported");
  });

  it("reports invalid for singular curves without bridging", () => {
    const geometry = compileCurveGeometry("1/t", "0", "0", {});
    const result = arcLength(geometry, { tMin: -1, tMax: 1 }, "medium");
    expect(result.status).toBe("invalid");
    expect(result.reason).toMatch(/non-finite/i);
  });
});

describe("scalar line integrals (S25 PART 7/37)", () => {
  it("integrates g=x over r=<t,0,0> as 1/2, direction-invariant", () => {
    const geometry = compileCurveGeometry("t", "0", "0", {});
    const forward = scalarLineIntegral(geometry, LINE, "x", {}, "medium");
    expect(forward.status).toBe("ok");
    expect(forward.value).toBeCloseTo(1 / 2, 10);
    // Scalar line integrals integrate g·speed with speed ≥ 0, so there is
    // no direction input: repeat evaluation must agree exactly (PART 37).
    const repeat = scalarLineIntegral(geometry, LINE, "x", {}, "medium");
    expect(repeat.status).toBe("ok");
    expect(repeat.value).toBe(forward.value);
  });

  it("matches arc length for g=1 on the circle", () => {
    const arc = arcLength(circle(), CIRCLE, "medium");
    const scalar = scalarLineIntegral(circle(), CIRCLE, "1", {}, "medium");
    expect(scalar.status).toBe("ok");
    expect(scalar.value).toBeCloseTo(arc.value, 10);
    expect(scalar.value).toBeCloseTo(2 * Math.PI, 6);
  });

  it("reports invalid for g=1/x across x=0", () => {
    const geometry = compileCurveGeometry("t", "0", "0", {});
    const result = scalarLineIntegral(geometry, { tMin: -1, tMax: 1 }, "1/x", {}, "medium");
    expect(result.status).toBe("invalid");
  });
});

describe("work and circulation (S25 PART 8/37)", () => {
  it("computes 1/2 for F=<x,0,0> along r=<t,0,0>", () => {
    const geometry = compileCurveGeometry("t", "0", "0", {});
    const result = workIntegral(geometry, LINE, { dimension: "3d", pExpr: "x", qExpr: "0", rExpr: "0" }, {}, "medium", 1);
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(1 / 2, 10);
  });

  it("computes 2*pi circulation with sign flip on reverse", () => {
    const forward = workIntegral(
      circle(),
      CIRCLE,
      { dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" },
      {},
      "high",
      1
    );
    expect(forward.status).toBe("ok");
    expect(forward.value).toBeCloseTo(2 * Math.PI, 6);
    const reverse = workIntegral(
      circle(),
      CIRCLE,
      { dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" },
      {},
      "high",
      -1
    );
    expect(reverse.status).toBe("ok");
    expect(reverse.value).toBeCloseTo(-2 * Math.PI, 6);
  });

  it("vanishes for the conservative field F=<2x,2y,0> on the circle", () => {
    const result = workIntegral(
      circle(),
      CIRCLE,
      { dimension: "3d", pExpr: "2*x", qExpr: "2*y", rExpr: "0" },
      {},
      "high",
      1
    );
    expect(result.status).toBe("ok");
    expect(Math.abs(result.value)).toBeLessThan(1e-6);
  });

  it("fail-closes 2D fields for 3D curves", () => {
    const result = workIntegral(
      circle(),
      CIRCLE,
      { dimension: "2d", pExpr: "-y", qExpr: "x", rExpr: "" },
      {},
      "medium",
      1
    );
    expect(result.status).toBe("invalid");
  });

  it("threads parameters without ambient reads", () => {
    const geometry = compileCurveGeometry("a*cos(t)", "a*sin(t)", "0", { a: 2 });
    const result = arcLength(geometry, CIRCLE, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4 * Math.PI, 6);
  });
});
