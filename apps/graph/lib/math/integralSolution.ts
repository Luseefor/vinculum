import type { IntegralAnalysisPayload, IntegralAnalysisOkResult, IntegralAnalysisNonOkResult } from "@/lib/compute/geometryComputeProtocol";
import type { FieldSolution } from "./fieldSolutions";

/** Explains the actual worker result, preserving numerical uncertainty. */
export function buildIntegralSolution(input: IntegralAnalysisPayload, result: IntegralAnalysisOkResult | IntegralAnalysisNonOkResult): FieldSolution {
  const formulas = {
    arcLength: "L = ∫ |r′(t)| dt", scalarLine: "I = ∫ g(r(t)) |r′(t)| dt", work: "W = ∫ F(r(t)) · r′(t) dt",
    surfaceArea: "A = ∬ |rᵤ × rᵥ| du dv", scalarSurface: "I = ∬ g(r(u,v)) |rᵤ × rᵥ| du dv", flux: "Φ = ∬ F(r(u,v)) · (rᵤ × rᵥ) du dv"
  };
  const labels = { arcLength: "Arc length", scalarLine: "Scalar line integral", work: "Work / circulation", surfaceArea: "Surface area", scalarSurface: "Scalar surface integral", flux: "Flux" };
  const target = input.target;
  const definition = target.kind === "surface" ? target.equation : `r(${target.kind === "parametricCurve" ? "t" : "u,v"}) = <${target.xExpr}, ${target.yExpr}, ${target.zExpr}>`;
  if (result.status !== "ok") return { definition, answers: [], notes: [], error: result.reason ?? "Integral solution is unavailable." };
  const steps = target.kind === "parametricCurve"
    ? [`Use t ∈ [${target.tMin}, ${target.tMax}].`, "Differentiate the curve components to obtain r′(t).", input.mode === "work" ? "Evaluate the field on the curve and take its dot product with r′(t)." : "Form the speed |r′(t)|." ]
    : [`Use the bounded surface domain: ${Object.entries(target.domain).map(([key, value]) => `${key} = ${value}`).join(", ")}.`, "Differentiate the surface parameterization in each independent variable.", input.mode === "flux" ? "Take the oriented cross product of the two tangent vectors and its dot product with the field." : "Take the magnitude of the cross product to obtain the area element."];
  if (input.mode === "scalarLine" || input.mode === "scalarSurface") steps.push(`Evaluate g = ${input.scalarIntegrand} on the source and multiply by the length or area element.`);
  if (input.field) steps.push(`F = <${input.field.pExpr}, ${input.field.qExpr}, ${input.field.rExpr}>.`);
  if (input.mode === "work") steps.push(`Curve direction multiplier: ${input.direction}.`);
  if (input.mode === "flux") steps.push(`Surface orientation multiplier: ${input.orientationSign}.`);
  steps.push(`Apply bounded composite Simpson quadrature at ${input.quality} quality.`, `Coarse estimate: ${result.coarseValue}. Fine estimate: ${result.value}.`, `Estimated numerical error: ${result.estimatedError}. Evaluations: ${result.evaluationCount}.`);
  return { definition, error: null, answers: [{ label: labels[input.mode], expressions: [String(result.value)], formula: formulas[input.mode], steps, errors: [] }], notes: ["This is a numerical calculation with an estimated error, rather than a symbolic proof.", ...(result.convergenceWarning ? ["The result has not converged closely at this quality. Increase quality or inspect the source domain."] : [])] };
}
