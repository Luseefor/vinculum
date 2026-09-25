import { describe, expect, it } from "vitest";
import { computeIntegralData } from "@/lib/math/computeIntegralData";

const CIRCLE = { kind: "parametricCurve", xExpr: "cos(t)", yExpr: "sin(t)", zExpr: "0", tMin: 0, tMax: 2 * Math.PI } as const;
const PLANE_Z = {
  kind: "surface",
  equation: "z = 0",
  orientation: "z",
  domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
} as const;
const ROTATION = { dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" } as const;

describe("computeIntegralData dispatch (S25)", () => {
  it("routes arc length and maps engine results", () => {
    const result = computeIntegralData({
      mode: "arcLength",
      target: { ...CIRCLE },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(2 * Math.PI, 6);
    expect(result.evaluations).toBeGreaterThan(0);
  });

  it("rejects mode/target mismatches without computing", () => {
    const fluxOnCurve = computeIntegralData({
      mode: "flux",
      target: { ...CIRCLE },
      scalarIntegrand: "",
      field: { ...ROTATION },
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(fluxOnCurve.status).toBe("error");
    const arcOnSurface = computeIntegralData({
      mode: "arcLength",
      target: { ...PLANE_Z },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(arcOnSurface.status).toBe("error");
  });

  it("requires fields for work/flux and rejects 2D fields", () => {
    const noField = computeIntegralData({
      mode: "work",
      target: { ...CIRCLE },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(noField.status).toBe("error");
    const flat = computeIntegralData({
      mode: "flux",
      target: { ...PLANE_Z },
      scalarIntegrand: "",
      field: { dimension: "2d", pExpr: "x", qExpr: "y", rExpr: "" },
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(flat.status).toBe("invalid");
  });

  it("propagates invalid/unsupported/budget statuses with reasons", () => {
    const singular = computeIntegralData({
      mode: "arcLength",
      target: { kind: "parametricCurve", xExpr: "1/t", yExpr: "0", zExpr: "0", tMin: -1, tMax: 1 },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(singular.status).toBe("invalid");
    expect(singular.reason).toMatch(/non-finite/i);
    const noDerivative = computeIntegralData({
      mode: "arcLength",
      target: { kind: "parametricCurve", xExpr: "tan(t)", yExpr: "t", zExpr: "0", tMin: 0, tMax: 1 },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1,
      params: {}
    });
    expect(noDerivative.status).toBe("unsupported");
  });
});
