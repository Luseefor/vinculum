import { compileVectorFieldExpressions } from "./compileVectorField";
import { compileScalarIntegrand } from "./compileScalarIntegrand";
import type { CompiledSurfaceGeometry } from "./surfaceGeometry";
import {
  integrateSimpson2D,
  SIMPSON_2D_FINE_N,
  type QuadratureQuality
} from "./simpsonQuadrature";
import type { IntegralStatus } from "./lineIntegrals";

// S25 surface integrals over compiled surface differential geometry.
// Pure and worker-safe (explicit params, no store). Formulas (all math
// coordinates — never world):
//
// area:            A = ∬ 1 dS                        = ∬ ||n|| du dv
// scalar surface:  ∬ g(P(u,v)) dS                   = ∬ g·||n|| du dv
// flux:            ∬ F(P) · dS_vec                   = ∬ F·n du dv
//
// where n is the directed area vector (explicit positive-axis normal or
// parametric Pu × Pv), optionally negated by orientationSign. Area and
// scalar integrals ignore orientation; flux reverses sign exactly.

export interface SurfaceIntegralResult {
  status: IntegralStatus;
  value: number;
  coarseValue: number;
  estimatedError: number;
  convergenceWarning: boolean;
  evaluations: number;
  reason: string | null;
}

// Upper bound on integrand evaluations per job (PART 23). High quality
// (97² nodes × ~12 evals ≈ 113k) fits orders of magnitude below.
const MAX_SURFACE_EVALUATIONS = 4_000_000;

function convergenceWarning(value: number, estimatedError: number): boolean {
  if (!Number.isFinite(estimatedError) || !Number.isFinite(value)) {
    return false;
  }
  return estimatedError > Math.max(1e-9, 1e-4 * Math.max(1, Math.abs(value)));
}

function failed(status: IntegralStatus, reason: string): SurfaceIntegralResult {
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
): SurfaceIntegralResult {
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

export interface SurfaceParameterDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

function checkDomain(domain: SurfaceParameterDomain): string | null {
  if (
    !Number.isFinite(domain.uMin) ||
    !Number.isFinite(domain.uMax) ||
    !Number.isFinite(domain.vMin) ||
    !Number.isFinite(domain.vMax)
  ) {
    return "Surface parameter domain is not finite.";
  }
  return null;
}

export function surfaceArea(
  geometry: CompiledSurfaceGeometry,
  domain: SurfaceParameterDomain,
  quality: QuadratureQuality
): SurfaceIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  const domainError = checkDomain(domain);
  if (domainError) {
    return failed("invalid", domainError);
  }
  const fineN = SIMPSON_2D_FINE_N[quality];
  if ((fineN + 1) * (fineN + 1) * 2 > MAX_SURFACE_EVALUATIONS) {
    return failed("budget-exceeded", "Surface-area quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson2D(
    (u, v) => {
      evaluations += 1;
      // S25-R1: position finiteness is enforced alongside the area
      // factor (contract: finite P AND finite Pu/Pv), matching the
      // scalar/flux integrands below.
      const point = geometry.evaluate(u, v);
      if (point.some((coordinate) => !Number.isFinite(coordinate))) {
        return Number.NaN;
      }
      return geometry.areaFactor(u, v);
    },
    domain.uMin,
    domain.uMax,
    domain.vMin,
    domain.vMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}

export function scalarSurfaceIntegral(
  geometry: CompiledSurfaceGeometry,
  domain: SurfaceParameterDomain,
  integrandExpr: string,
  params: Record<string, number>,
  quality: QuadratureQuality
): SurfaceIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  const domainError = checkDomain(domain);
  if (domainError) {
    return failed("invalid", domainError);
  }
  const integrand = compileScalarIntegrand(integrandExpr, params);
  if (integrand.error) {
    return failed("invalid", integrand.error);
  }
  const fineN = SIMPSON_2D_FINE_N[quality];
  if ((fineN + 1) * (fineN + 1) * 6 > MAX_SURFACE_EVALUATIONS) {
    return failed("budget-exceeded", "Scalar surface quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson2D(
    (u, v) => {
      evaluations += 1;
      const point = geometry.evaluate(u, v);
      if (point.some((coordinate) => !Number.isFinite(coordinate))) {
        return Number.NaN;
      }
      const g = integrand.evaluator(point[0] as number, point[1] as number, point[2] as number);
      if (!Number.isFinite(g)) {
        return Number.NaN;
      }
      const factor = geometry.areaFactor(u, v);
      if (!Number.isFinite(factor)) {
        return Number.NaN;
      }
      return g * factor;
    },
    domain.uMin,
    domain.uMax,
    domain.vMin,
    domain.vMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}

export interface FluxFieldSnapshot {
  pExpr: string;
  qExpr: string;
  rExpr: string;
}

export function fluxIntegral(
  geometry: CompiledSurfaceGeometry,
  domain: SurfaceParameterDomain,
  field: FluxFieldSnapshot,
  params: Record<string, number>,
  quality: QuadratureQuality,
  orientationSign: 1 | -1
): SurfaceIntegralResult {
  if (geometry.error) {
    return failed("unsupported", "Derivative unavailable for this source.");
  }
  const domainError = checkDomain(domain);
  if (domainError) {
    return failed("invalid", domainError);
  }
  // Flux is 3D-only: the directed area vector is always 3-component, so
  // a 2D field can never dot against it (fail closed, PART 13).
  const compiled = compileVectorFieldExpressions("3d", field.pExpr, field.qExpr, field.rExpr, params);
  if (compiled.error || !compiled.evaluate3D) {
    return failed("invalid", compiled.error ?? "Vector field could not be compiled.");
  }
  const evaluate3D = compiled.evaluate3D;
  const fineN = SIMPSON_2D_FINE_N[quality];
  if ((fineN + 1) * (fineN + 1) * 12 > MAX_SURFACE_EVALUATIONS) {
    return failed("budget-exceeded", "Flux quadrature exceeds the evaluation budget.");
  }
  let evaluations = 0;
  const quadrature = integrateSimpson2D(
    (u, v) => {
      evaluations += 1;
      const point = geometry.evaluate(u, v);
      const normal = geometry.areaVector(u, v);
      if (
        point.some((coordinate) => !Number.isFinite(coordinate)) ||
        normal.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        return Number.NaN;
      }
      const force = evaluate3D(point[0] as number, point[1] as number, point[2] as number);
      if (force.some((component) => !Number.isFinite(component))) {
        return Number.NaN;
      }
      // Native orientation dotted directly; Reverse negates exactly.
      const dot =
        (force[0] as number) * (normal[0] as number) +
        (force[1] as number) * (normal[1] as number) +
        (force[2] as number) * (normal[2] as number);
      return orientationSign * dot;
    },
    domain.uMin,
    domain.uMax,
    domain.vMin,
    domain.vMax,
    fineN
  );
  return toResult(quadrature, evaluations);
}
