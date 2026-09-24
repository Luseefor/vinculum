import { compilePartialDerivative } from "./compilePartialDerivative";
import type { VectorFieldDimension } from "@vinculum/scene/types";

// S22 pointwise vector calculus: Jacobian, divergence, and curl of
// canonical vector fields. Built directly on the S21 symbolic derivative
// core (compilePartialDerivative) — no second calculus subsystem, no
// finite-difference fallback, same S11 generated-AST safety.
//
// Conventions (pinned by tests):
// - Jacobian rows are components, columns are variables:
//   3D J[i][j] = d(component_i)/d(var_j), 2D [[Px,Py],[Qx,Qy]].
// - Divergence = trace of the required diagonal (computed FROM the
//   Jacobian entries: one derivative source of truth, PART 4).
// - 3D curl = <Ry-Qz, Pz-Rx, Qx-Py> with J[row][col] indexing.
// - 2D scalar curl = Qx-Py (z-component only; no manufactured vector).
//
// Partial availability (PART 24): each entry carries its own ok/error, and
// divergence/curl compute from whatever their dependencies allow — a
// missing Pz kills the curl components that need it but never blocks the
// divergence. Nothing is ever invented (no zero-fill).

export interface JacobianEntryOk {
  ok: true;
  evaluate: (scope: Record<string, number>) => number;
}

export interface JacobianEntryError {
  ok: false;
  error: string;
}

export type JacobianEntry = JacobianEntryOk | JacobianEntryError;

export interface CompiledVectorDifferential {
  dimension: VectorFieldDimension;
  rows: number;
  cols: number;
  entries: JacobianEntry[][];
}

export function compileVectorFieldDifferential(
  dimension: VectorFieldDimension,
  pExpr: string,
  qExpr: string,
  rExpr: string,
  params: Record<string, number>
): CompiledVectorDifferential {
  const variables = dimension === "2d" ? ["x", "y"] : ["x", "y", "z"];
  const components = dimension === "2d" ? [pExpr, qExpr] : [pExpr, qExpr, rExpr];
  const allowedSymbols = [...Object.keys(params), ...variables];
  const entries: JacobianEntry[][] = components.map((component) =>
    variables.map((variable) => {
      const compiled = compilePartialDerivative({ expression: component, variable, allowedSymbols, params });
      if (compiled.error) {
        return { ok: false as const, error: compiled.error };
      }
      return { ok: true as const, evaluate: compiled.evaluate };
    })
  );
  return { dimension, rows: components.length, cols: variables.length, entries };
}

export interface EvaluatedJacobian {
  rows: number;
  cols: number;
  values: (number | null)[][];
}

// Evaluates all entries at a math point. Reserved locals (t/u/v always;
// z for 2D) are poisoned to NaN AFTER the point spreads, so meaningless
// dependencies evaluate unavailable instead of silently binding ambient
// values — mirroring the S20 reserved-local policy at evaluation time (the
// field-level compiler rejects them outright; this is defense in depth).
// Point coordinates always win over same-named parameters (S19 convention).
export function evaluateVectorDifferential(
  compiled: CompiledVectorDifferential,
  point: { x: number; y: number; z?: number },
  params: Record<string, number>
): EvaluatedJacobian {
  const scope: Record<string, number> = {
    ...params,
    ...point,
    t: Number.NaN,
    u: Number.NaN,
    v: Number.NaN
  };
  if (compiled.dimension === "2d") {
    scope.z = Number.NaN;
  }
  const values = compiled.entries.map((row) =>
    row.map((entry) => {
      if (!entry.ok) {
        return null;
      }
      const value = entry.evaluate(scope);
      return Number.isFinite(value) ? value : null;
    })
  );
  return { rows: compiled.rows, cols: compiled.cols, values };
}

// Divergence = trace over the required diagonal (2D: Px+Qy, 3D: +Rz).
// Null when any required entry is unavailable.
export function vectorDivergence(jacobian: EvaluatedJacobian): number | null {
  const size = Math.min(jacobian.rows, jacobian.cols);
  let sum = 0;
  for (let i = 0; i < size; i += 1) {
    const value = jacobian.values[i]?.[i];
    if (typeof value !== "number") {
      return null;
    }
    sum += value;
  }
  return Number.isFinite(sum) ? sum : null;
}

export interface VectorCurl3D {
  x: number | null;
  y: number | null;
  z: number | null;
}

// 3D curl = <Ry-Qz, Pz-Rx, Qx-Py>, per-component availability: a missing
// entry nulls only the components that require it.
export function vectorCurl3D(jacobian: EvaluatedJacobian): VectorCurl3D | null {
  if (jacobian.rows < 3 || jacobian.cols < 3) {
    return null;
  }
  const at = (row: number, col: number): number | null => {
    const value = jacobian.values[row]?.[col];
    return typeof value === "number" ? value : null;
  };
  const combine = (a: number | null, b: number | null): number | null => {
    if (a === null || b === null) {
      return null;
    }
    const value = a - b;
    return Number.isFinite(value) ? value : null;
  };
  return {
    x: combine(at(2, 1), at(1, 2)),
    y: combine(at(0, 2), at(2, 0)),
    z: combine(at(1, 0), at(0, 1))
  };
}

// 2D scalar curl (z-component) = Qx-Py. Null when either is unavailable.
export function vectorCurlScalar2D(jacobian: EvaluatedJacobian): number | null {
  if (jacobian.rows < 2 || jacobian.cols < 2) {
    return null;
  }
  const qx = jacobian.values[1]?.[0];
  const py = jacobian.values[0]?.[1];
  if (typeof qx !== "number" || typeof py !== "number") {
    return null;
  }
  const value = qx - py;
  return Number.isFinite(value) ? value : null;
}

// Zero-magnitude threshold for curl overlays (mirrors GRADIENT_ZERO_EPS
// policy: O(1)-coefficient fields live far above it; below it an arrow
// would be noise). Zero curl itself stays valid numerical output.
export const CURL_ZERO_EPS = 1e-12;

// Domain containment for analysis points (PART 6/34). Canonical math
// coordinates only — never world/screen. The field domain is part of the
// canonical object, so a point outside it shows "outside the field domain"
// instead of evaluating silently. Inverted ranges (min > max) are treated
// as the span between them so Inspector edits cannot strand a point.
export function isFieldPointInDomain(
  dimension: VectorFieldDimension,
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number },
  point: { x: number; y: number; z?: number }
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return false;
  }
  const inRange = (value: number, a: number, b: number): boolean => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return false;
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return value >= lo && value <= hi;
  };
  if (!inRange(point.x, domain.xMin, domain.xMax)) {
    return false;
  }
  if (!inRange(point.y, domain.yMin, domain.yMax)) {
    return false;
  }
  if (dimension === "3d") {
    if (point.z === undefined || !Number.isFinite(point.z)) {
      return false;
    }
    if (domain.zMin === undefined || domain.zMax === undefined) {
      return false;
    }
    if (!inRange(point.z, domain.zMin, domain.zMax)) {
      return false;
    }
  }
  return true;
}
