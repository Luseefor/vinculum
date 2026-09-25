import { compileCurveGeometry } from "./curveGeometry";
import { arcLength, scalarLineIntegral, workIntegral } from "./lineIntegrals";
import {
  compileExplicitSurfaceGeometry,
  compileParametricSurfaceGeometry
} from "./surfaceGeometry";
import { fluxIntegral, scalarSurfaceIntegral, surfaceArea } from "./surfaceIntegrals";
import type { QuadratureQuality } from "./simpsonQuadrature";

// S25 pure integral orchestrator: one entry per analysis mode over
// canonical snapshots. No React/Three/stores/DOM — the same function runs
// in the S19 worker and in unit tests (parity is structural). Compiles
// happen ONCE per call (PART 16); quadrature nodes evaluate compiled
// closures, never recompiling per node. Results are plain numbers (PART
// 22: no transferable buffers needed).
//
// All mathematics happens in CANONICAL MATH coordinates (PART 38) —
// never world. Expression/domain inputs come from canonical objects,
// never rendered geometry (PART 39): render tessellation cannot change
// these integrals.

export type IntegralAnalysisMode =
  | "arcLength"
  | "scalarLine"
  | "work"
  | "surfaceArea"
  | "scalarSurface"
  | "flux";

export interface IntegralCurveTarget {
  kind: "parametricCurve";
  xExpr: string;
  yExpr: string;
  zExpr: string;
  tMin: number;
  tMax: number;
}

export interface IntegralExplicitSurfaceTarget {
  kind: "surface";
  equation: string;
  orientation: "x" | "y" | "z";
  domain: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface IntegralParametricSurfaceTarget {
  kind: "parametricSurface";
  xExpr: string;
  yExpr: string;
  zExpr: string;
  domain: { uMin: number; uMax: number; vMin: number; vMax: number };
}

export type IntegralTarget =
  | IntegralCurveTarget
  | IntegralExplicitSurfaceTarget
  | IntegralParametricSurfaceTarget;

export interface IntegralFieldSnapshot {
  dimension: "2d" | "3d";
  pExpr: string;
  qExpr: string;
  rExpr: string;
}

export interface IntegralComputeInput {
  mode: IntegralAnalysisMode;
  target: IntegralTarget;
  /** Scalar integrand g(x,y,z); required for scalarLine/scalarSurface. */
  scalarIntegrand: string;
  /** Canonical field snapshot; required for work/flux. */
  field: IntegralFieldSnapshot | null;
  quality: QuadratureQuality;
  /** Curve direction: 1 forward (increasing t), -1 reverse. */
  direction: 1 | -1;
  /** Flux orientation: 1 native, -1 reversed. */
  orientationSign: 1 | -1;
  params: Record<string, number>;
}

export type IntegralComputeStatus = "ok" | "invalid" | "unsupported" | "budget-exceeded" | "error";

export interface IntegralComputeResult {
  status: IntegralComputeStatus;
  value: number;
  coarseValue: number;
  estimatedError: number;
  convergenceWarning: boolean;
  evaluations: number;
  reason: string | null;
}

const NAN_RESULT: Omit<IntegralComputeResult, "status" | "reason"> = {
  value: Number.NaN,
  coarseValue: Number.NaN,
  estimatedError: Number.NaN,
  convergenceWarning: false,
  evaluations: 0
};

function toComputeResult(
  engine: { status: string; value: number; coarseValue: number; estimatedError: number; convergenceWarning: boolean; evaluations: number; reason: string | null },
  evaluations: number
): IntegralComputeResult {
  if (engine.status === "ok") {
    return {
      status: "ok",
      value: engine.value,
      coarseValue: engine.coarseValue,
      estimatedError: engine.estimatedError,
      convergenceWarning: engine.convergenceWarning,
      evaluations: engine.evaluations,
      reason: null
    };
  }
  const status =
    engine.status === "invalid" ||
    engine.status === "unsupported" ||
    engine.status === "budget-exceeded"
      ? engine.status
      : "error";
  return { ...NAN_RESULT, status, evaluations: engine.evaluations || evaluations, reason: engine.reason };
}

export function computeIntegralData(input: IntegralComputeInput): IntegralComputeResult {
  const { mode, target, quality, params } = input;
  if (target.kind === "parametricCurve") {
    if (mode !== "arcLength" && mode !== "scalarLine" && mode !== "work") {
      return { ...NAN_RESULT, status: "error", reason: "Integral mode is incompatible with curves." };
    }
    const geometry = compileCurveGeometry(target.xExpr, target.yExpr, target.zExpr, params);
    const domain = { tMin: target.tMin, tMax: target.tMax };
    if (mode === "arcLength") {
      const engine = arcLength(geometry, domain, quality);
      return toComputeResult(engine, engine.evaluations);
    }
    if (mode === "scalarLine") {
      const engine = scalarLineIntegral(geometry, domain, input.scalarIntegrand, params, quality);
      return toComputeResult(engine, engine.evaluations);
    }
    if (!input.field) {
      return { ...NAN_RESULT, status: "error", reason: "Work integrals require a vector field." };
    }
    if (input.field.dimension !== "3d") {
      return { ...NAN_RESULT, status: "invalid", reason: "Work integrals require a 3D vector field for a 3D curve." };
    }
    const engine = workIntegral(
      geometry,
      domain,
      { dimension: input.field.dimension, pExpr: input.field.pExpr, qExpr: input.field.qExpr, rExpr: input.field.rExpr },
      params,
      quality,
      input.direction
    );
    return toComputeResult(engine, engine.evaluations);
  }
  if (target.kind !== "surface" && target.kind !== "parametricSurface") {
    return { ...NAN_RESULT, status: "error", reason: "Unsupported integral target." };
  }
  if (mode !== "surfaceArea" && mode !== "scalarSurface" && mode !== "flux") {
    return { ...NAN_RESULT, status: "error", reason: "Integral mode is incompatible with surfaces." };
  }
  const geometry =
    target.kind === "surface"
      ? compileExplicitSurfaceGeometry(target.equation, target.orientation, params)
      : compileParametricSurfaceGeometry(target.xExpr, target.yExpr, target.zExpr, params);
  // Parameter rectangle mirrors the canonical domains (S23 convention:
  // explicit x/y ranges always span the independent variables).
  const domain =
    target.kind === "surface"
      ? { uMin: target.domain.xMin, uMax: target.domain.xMax, vMin: target.domain.yMin, vMax: target.domain.yMax }
      : { uMin: target.domain.uMin, uMax: target.domain.uMax, vMin: target.domain.vMin, vMax: target.domain.vMax };
  if (mode === "surfaceArea") {
    const engine = surfaceArea(geometry, domain, quality);
    return toComputeResult(engine, engine.evaluations);
  }
  if (mode === "scalarSurface") {
    const engine = scalarSurfaceIntegral(geometry, domain, input.scalarIntegrand, params, quality);
    return toComputeResult(engine, engine.evaluations);
  }
  if (!input.field) {
    return { ...NAN_RESULT, status: "error", reason: "Flux integrals require a vector field." };
  }
  if (input.field.dimension !== "3d") {
    return { ...NAN_RESULT, status: "invalid", reason: "Flux integrals require a 3D vector field." };
  }
  const engine = fluxIntegral(
    geometry,
    domain,
    { pExpr: input.field.pExpr, qExpr: input.field.qExpr, rExpr: input.field.rExpr },
    params,
    quality,
    input.orientationSign
  );
  return toComputeResult(engine, engine.evaluations);
}
