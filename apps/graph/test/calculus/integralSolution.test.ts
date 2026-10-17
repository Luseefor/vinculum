import { describe, expect, it } from "vitest";
import { buildIntegralSolution } from "@/lib/math/calculus/integralSolution";
import type { IntegralAnalysisPayload } from "@/lib/compute/geometryComputeProtocol";

const payload: IntegralAnalysisPayload = { mode: "work", target: { kind: "parametricCurve", xExpr: "cos(t)", yExpr: "sin(t)", zExpr: "0", tMin: 0, tMax: 2 * Math.PI }, field: { dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" }, scalarIntegrand: "", quality: "medium", direction: -1, orientationSign: 1 };
describe("integral solution explanations", () => {
  it("reports the actual quadrature values, direction, and uncertainty", () => {
    const result = buildIntegralSolution(payload, { status: "ok", value: -2*Math.PI, coarseValue: -6.28, estimatedError: 0.001, convergenceWarning: true, evaluationCount: 100 });
    expect(result.error).toBeNull();
    expect(result.answers[0]?.expressions).toEqual([String(-2*Math.PI)]);
    expect(result.answers[0]?.steps.join(" ")).toContain("Curve direction multiplier: -1");
    expect(result.answers[0]?.steps.join(" ")).toContain("Evaluations: 100");
    expect(result.notes.join(" ")).toMatch(/numerical calculation/);
    expect(result.notes.join(" ")).toMatch(/not converged/);
  });
  it("does not present an answer for failed numerical integration", () => {
    const result = buildIntegralSolution(payload, { status: "invalid", reason: "Non-finite integrand." });
    expect(result.answers).toEqual([]);
    expect(result.error).toBe("Non-finite integrand.");
  });

  it("explains both height functions and all side walls for solid boundary area", () => {
    const input: IntegralAnalysisPayload = { ...payload, mode: "solidArea", target: { kind: "surface", equation: "z=3", orientation: "z", domain: { xMin: 0, xMax: 2, yMin: 0, yMax: 4 } }, lowerBoundary: "1", field: null };
    const result = buildIntegralSolution(input, { status: "ok", value: 40, coarseValue: 40, estimatedError: 0, convergenceWarning: false, evaluationCount: 100 });
    expect(result.answers[0]?.formula).toContain("A(sides)");
    expect(result.answers[0]?.steps.join(" ")).toContain("g = 1");
    expect(result.answers[0]?.steps.join(" ")).toContain("four side-wall areas");
  });

  it("describes topology checks and mesh uncertainty for enclosed volume", () => {
    const input: IntegralAnalysisPayload = { ...payload, mode: "volume", target: { kind: "implicitSurface", equation: "x^2+y^2+z^2=1", domain: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 } }, field: null };
    const result = buildIntegralSolution(input, { status: "ok", value: 4.18, coarseValue: 4.1, estimatedError: .08, convergenceWarning: true, evaluationCount: 1000 });
    expect(result.answers[0]?.formula).toContain("Σ");
    expect(result.answers[0]?.steps.join(" ")).toContain("Reject open or clipped boundaries");
    expect(result.answers[0]?.steps.join(" ")).toContain("Compare coarse and fine mesh measurements");
    expect(result.answers[0]?.steps.join(" ")).not.toContain("Simpson");
  });
});
