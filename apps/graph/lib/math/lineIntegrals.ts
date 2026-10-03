import { compileVectorFieldExpressions } from "./compileVectorField";
import { compileScalarIntegrand } from "./compileScalarIntegrand";
import type { CompiledCurveGeometry } from "./curveGeometry";
import {
  integrateSimpson1D,
  SIMPSON_1D_FINE_N,
  type QuadratureQuality
} from "./simpsonQuadrature";

// S25 line integrals over parametric-curve differential geometry. Pure
// and worker-safe (explicit params, no store). Formulas:
//
// arc length:      L = ∫ ||r'(t)|| dt
// scalar line:     ∫ g(r(t)) · ||r'(t)|| dt
// work:            ∫ F(r(t)) · r'(t) dt   (3D field; orientation matters)
//
// Direction convention: canonical orientation is increasing t. Reverse
// negates work exactly (local sign flip, 0 extra jobs); arc length and
// scalar line are direction-invariant by construction (speed ≥ 0).
// Curves are always 3-component; work requires a 3D vector field — a 2D
// field is fail-closed incompatible, never silently <P,Q,0> (PART 8).

export type IntegralStatus = "ok" | "invalid" | "unsupported" | "budget-exceeded" | "error";

export interface LineIntegralResult {
  status: IntegralStatus;
  value: number;
  coarseValue: number;
  estimatedError: number;
  /** True when the estimate is large against the result scale. */
  convergenceWarning: boolean;
  evaluations: number;
  reason: string | null;
}

// Upper bound on integrand evaluations per job (PART 23). Quality
// presets fit orders of magnitude below; the cap only binds malformed
// payloads that bypass validation.
const MAX_LINE_EVALUATIONS = 2_000_000;

function convergenceWarning(value: number, estimatedError: number): boolean {
  if (!Number.isFinite(estimatedError) || !Number.isFinite(value)) {
    return false;
  }
  return estimatedError > Math.max(1e-9, 1e-4 * Math.max(1, Math.abs(value)));
}

function failed(status: IntegralStatus, reason: string): LineIntegralResult {
  return {
    status,
    value: Number.NaN,
    coarseValue: Number.NaN,
    estimatedError: Number.NaN,
    convergenceWarning: false,
    evaluations: 0,
    reason
  };
}

function toResult(
  quadrature: { status: string; value: number; coarseValue: number; estimatedError: number; evaluations: number },
  evaluations: number
): LineIntegralResult {
  if (quadrature.status !== "ok") {
    return {
      status: "invalid",
      value: Number.NaN,
      coarseValue: Number.NaN,
      estimatedError: Number.NaN,
      convergenceWarning: false,
      evaluations,
      reason: "Integrand is non-finite in the integration domain."
    };
  }
  return {
    status: "ok",
    value: quadrature.value,
    coarseValue: quadrature.coarseValue,
    estimatedError: quadrature.estimatedError,
    convergenceWarning: convergenceWarning(quadrature.value, quadrature.estimatedError),
    evaluations,
    reason: null
  };
}

export interface CurveDomain {
  tMin: number;
  tMax: number;
}

export function arcLength(
  geometry: CompiledCurveGeometry,
  domain: CurveDomain,
  quality: QuadratureQuality
): LineIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  if (!Number.isFinite(domain.tMin) || !Number.isFinite(domain.tMax)) {
    return failed("invalid", "Curve parameter domain is not finite.");
  }
  const fineN = SIMPSON_1D_FINE_N[quality];
  if ((fineN + 1) * 3 > MAX_LINE_EVALUATIONS) {
    return failed("budget-exceeded", "Arc-length quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson1D(
    (t) => {
      evaluations += 1;
      // S25-R1: position finiteness is enforced alongside speed (contract:
      // finite r AND r′), matching scalarLine/work/flux below.
      const point = geometry.evaluate(t);
      if (point.some((coordinate) => !Number.isFinite(coordinate))) {
        return Number.NaN;
      }
      return geometry.speed(t);
    },
    domain.tMin,
    domain.tMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}

export function scalarLineIntegral(
  geometry: CompiledCurveGeometry,
  domain: CurveDomain,
  integrandExpr: string,
  params: Record<string, number>,
  quality: QuadratureQuality
): LineIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  if (!Number.isFinite(domain.tMin) || !Number.isFinite(domain.tMax)) {
    return failed("invalid", "Curve parameter domain is not finite.");
  }
  const integrand = compileScalarIntegrand(integrandExpr, params);
  if (integrand.error) {
    return failed("invalid", integrand.error);
  }
  const fineN = SIMPSON_1D_FINE_N[quality];
  if ((fineN + 1) * 7 > MAX_LINE_EVALUATIONS) {
    return failed("budget-exceeded", "Scalar line quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson1D(
    (t) => {
      evaluations += 1;
      const point = geometry.evaluate(t);
      if (point.some((coordinate) => !Number.isFinite(coordinate))) {
        return Number.NaN;
      }
      const g = integrand.evaluator(point[0] as number, point[1] as number, point[2] as number);
      if (!Number.isFinite(g)) {
        return Number.NaN;
      }
      return g * geometry.speed(t);
    },
    domain.tMin,
    domain.tMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}

export interface WorkFieldSnapshot {
  dimension: "2d" | "3d";
  pExpr: string;
  qExpr: string;
  rExpr: string;
}

export function workIntegral(
  geometry: CompiledCurveGeometry,
  domain: CurveDomain,
  field: WorkFieldSnapshot,
  params: Record<string, number>,
  quality: QuadratureQuality,
  direction: 1 | -1
): LineIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  if (field.dimension !== "3d") {
    // PART 8 dimension filter: no silent <P,Q,0> invention for 3D curves.
    return failed("invalid", "Work integrals require a 3D vector field for a 3D curve.");
  }
  if (!Number.isFinite(domain.tMin) || !Number.isFinite(domain.tMax)) {
    return failed("invalid", "Curve parameter domain is not finite.");
  }
  const compiled = compileVectorFieldExpressions(
    "3d",
    field.pExpr,
    field.qExpr,
    field.rExpr,
    params
  );
  if (compiled.error || !compiled.evaluate3D) {
    return failed("invalid", compiled.error ?? "Vector field could not be compiled.");
  }
  const evaluate3D = compiled.evaluate3D;
  const fineN = SIMPSON_1D_FINE_N[quality];
  if ((fineN + 1) * 9 > MAX_LINE_EVALUATIONS) {
    return failed("budget-exceeded", "Work quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson1D(
    (t) => {
      evaluations += 1;
      const point = geometry.evaluate(t);
      const tangent = geometry.derivative(t);
      if (
        point.some((coordinate) => !Number.isFinite(coordinate)) ||
        tangent.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        return Number.NaN;
      }
      const force = evaluate3D(point[0] as number, point[1] as number, point[2] as number);
      if (force.some((component) => !Number.isFinite(component))) {
        return Number.NaN;
      }
      const dot =
        (force[0] as number) * (tangent[0] as number) +
        (force[1] as number) * (tangent[1] as number) +
        (force[2] as number) * (tangent[2] as number);
      // Canonical orientation is increasing t; Reverse negates exactly.
      return direction * dot;
    },
    domain.tMin,
    domain.tMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}
