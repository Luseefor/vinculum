import type { IntegralAnalysisPayload, IntegralAnalysisOkResult, IntegralAnalysisNonOkResult } from "@/lib/compute/geometryComputeProtocol";
import type { FieldSolution } from "../fields/fieldSolutions";

/** Explains the actual worker result, preserving numerical uncertainty. */
export function buildIntegralSolution(input: IntegralAnalysisPayload, result: IntegralAnalysisOkResult | IntegralAnalysisNonOkResult): FieldSolution {
  const formulas = {
    arcLength: "L = ∫ |r′(t)| dt", scalarLine: "I = ∫ g(r(t)) |r′(t)| dt", work: "W = ∫ F(r(t)) · r′(t) dt",
    surfaceArea: "A = ∬ |rᵤ × rᵥ| du dv", scalarSurface: "I = ∬ g(r(u,v)) |rᵤ × rᵥ| du dv", flux: "Φ = ∬ F(r(u,v)) · (rᵤ × rᵥ) du dv", solidArea: "A = A(f) + A(g) + A(sides)", volume: "V = ∬ |f - g| du dv"
  };
  const labels = { arcLength: "Arc length", scalarLine: "Scalar line integral", work: "Work / circulation", surfaceArea: "Surface area", scalarSurface: "Scalar surface integral", flux: "Flux", solidArea: "Solid boundary area", volume: "Volume" };
  const target = input.target;
  const definition = target.kind === "surface" || target.kind === "implicitSurface" ? target.equation : `r(${target.kind === "parametricCurve" ? "t" : "u,v"}) = <${target.xExpr}, ${target.yExpr}, ${target.zExpr}>`;
  if (result.status !== "ok") return { definition, answers: [], notes: [], error: result.reason ?? "Integral solution is unavailable." };
  const mesh = target.kind === "implicitSurface" || (target.kind === "parametricSurface" && input.mode === "volume");
  const solid = target.kind === "surface" && (input.mode === "volume" || input.mode === "solidArea");
  const steps = target.kind === "parametricCurve"
    ? [`Use t ∈ [${target.tMin}, ${target.tMax}].`, "Differentiate the curve components to obtain r′(t).", input.mode === "work" ? "Evaluate the field on the curve and take its dot product with r′(t)." : "Form the speed |r′(t)|." ]
    : [`Use the bounded surface domain: ${Object.entries(target.domain).map(([key, value]) => `${key} = ${value}`).join(", ")}.`, "Differentiate the surface parameterization in each independent variable.", input.mode === "flux" ? "Take the oriented cross product of the two tangent vectors and its dot product with the field." : "Take the magnitude of the cross product to obtain the area element."];
  if (solid) {
    steps.splice(1);
    steps.push(`Use the other boundary g = ${input.lowerBoundary ?? "0"}.`, "The thickness is |f(u,v) - g(u,v)|, so geometric volume is nonnegative even when the graphs cross.", input.mode === "volume" ? "Integrate the thickness over the saved input rectangle." : "Integrate both surface area elements and add the four side-wall areas ∫|f-g| ds. Coincident boundaries enclose zero volume and have zero solid boundary area.");
  }
  if (mesh) {
    steps.splice(1);
    steps.push("Sample the canonical definition at two analysis resolutions, independently of display tessellation.", input.mode === "volume" ? "Weld seams and poles; require every triangle edge to belong to two consistently oriented faces. Reject open or clipped boundaries." : "Sum the area of the sampled triangles within the plot range.", input.mode === "volume" ? "Recenter the mesh and sum signed tetrahedron volumes a·(b×c)/6; take the absolute total." : "Each triangle contributes |(b-a)×(c-a)|/2.");
    formulas.volume = "V = |Σ a · (b × c) / 6|";
    formulas.surfaceArea = "A = Σ |(b-a) × (c-a)| / 2";
  }
  if (input.mode === "scalarLine" || input.mode === "scalarSurface") steps.push(`Evaluate g = ${input.scalarIntegrand} on the source and multiply by the length or area element.`);
  if (input.field) steps.push(`F = <${input.field.pExpr}, ${input.field.qExpr}, ${input.field.rExpr}>.`);
  if (input.mode === "work") steps.push(`Curve direction multiplier: ${input.direction}.`);
  if (input.mode === "flux") steps.push(`Surface orientation multiplier: ${input.orientationSign}.`);
  steps.push(mesh ? `Compare coarse and fine mesh measurements at ${input.quality} quality; their absolute difference estimates uncertainty.` : `Apply bounded composite Simpson quadrature at ${input.quality} quality.`, `Coarse estimate: ${result.coarseValue}. Fine estimate: ${result.value}.`, `Estimated numerical error: ${result.estimatedError}. ${mesh ? "Grid sample points" : "Evaluations"}: ${result.evaluationCount}.`);
  return { definition, error: null, answers: [{ label: labels[input.mode], expressions: [String(result.value)], formula: formulas[input.mode], steps, errors: [] }], notes: ["This is a numerical calculation with an estimated error, rather than a symbolic proof.", ...(result.convergenceWarning ? ["The result has not converged closely at this quality. Increase quality or inspect the source domain."] : [])] };
}
