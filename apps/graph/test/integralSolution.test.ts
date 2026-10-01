import { describe, expect, it } from "vitest";
import { buildIntegralSolution } from "@/lib/math/integralSolution";
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
});
