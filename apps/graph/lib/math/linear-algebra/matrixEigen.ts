// S28 eigen analysis over the mathjs numerical eigensolver.
//
// EIGEN GATE DECISION (PART 8, characterized before product code):
// reuse mathjs `eigs` — already a direct dependency (no new package),
// browser-compatible pure JS, correct on 2×2/3×3 diagonal, rotation
// (complex ±i), shear (single independent direction), defective 3×3
// (fewer vectors than values — honest, never fabricated), and repeated
// eigenvalues with full eigenspaces. No hand-rolled cubic/root solver.
//
// This module normalizes solver output into a deterministic pure result:
// - real eigenvalues ascending; complex after (re, then im); the library
//   order is never trusted (PART 59).
// - real eigenvectors unit-normalized with first-significant-component-
//   positive sign convention (display determinism, not uniqueness).
// - every real pair residual-checked: ||Av − λv|| against a scale-aware
//   tolerance from the matrix Frobenius norm; poor residuals mark the
//   pair failed rather than rendering a fake eigendirection (PART 9/52).
// - complex eigenvalues preserved as lightweight {re,im} for honest
//   "No real eigendirections" UI; no complex vectors anywhere.
// - defective matrices report exactly the independent directions found
//   ("1 independent real eigendirection"), never padded (PART 61).

import { eigs } from "mathjs";
import {
  frobeniusNorm,
  MATRIX_ABS_TOL,
  MATRIX_REL_TOL,
  matrixVectorMultiply2,
  matrixVectorMultiply3
} from "./matrix";

export interface ComplexValue {
  re: number;
  im: number;
}

export type EigenValue = number | ComplexValue;

export interface RealEigenpair {
  kind: "real";
  value: number;
  /** Unit length, sign-normalized. Residual-verified. */
  vector: number[];
  residual: number;
}

export interface ComplexEigenvalue {
  kind: "complex";
  value: ComplexValue;
}

export interface FailedEigenpair {
  kind: "failed";
  value: number;
  reason: string;
}

export type EigenEntry = RealEigenpair | ComplexEigenvalue | FailedEigenpair;

export interface EigenAnalysis {
  dimension: 2 | 3;
  /** Deterministic order: real ascending, then complex (re, im). */
  entries: EigenEntry[];
  /** Count of verified independent real eigendirections. */
  realDirectionCount: number;
  /** True when the solver itself threw or returned garbage. */
  unavailable: boolean;
}

function isComplexLike(value: unknown): value is { re: number; im: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.re === "number" && typeof record.im === "number";
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out: number[] = [];
  for (const entry of value) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push(entry);
      continue;
    }
    return null;
  }
  return out;
}

function vectorMagnitude(vector: readonly number[]): number {
  let sum = 0;
  for (const entry of vector) {
    sum += entry * entry;
  }
  return Math.sqrt(sum);
}

function normalizeSign(vector: number[]): number[] {
  const normalized = [...vector];
  for (let index = 0; index < normalized.length; index += 1) {
    const entry = normalized[index] as number;
    if (Math.abs(entry) > 1e-12) {
      if (entry < 0) {
        return normalized.map((value) => -value);
      }
      return normalized;
    }
  }
  return normalized;
}

function residualTolerance(matrixNorm: number): number {
  return MATRIX_ABS_TOL + MATRIX_REL_TOL * Math.max(1, matrixNorm);
}

function applyMatrix(entries: readonly number[], dimension: 2 | 3, vector: readonly number[]): number[] | null {
  if (vector.length !== dimension) {
    return null;
  }
  if (dimension === 2) {
    const [x, y] = matrixVectorMultiply2(
      [entries[0] as number, entries[1] as number, entries[2] as number, entries[3] as number],
      [vector[0] as number, vector[1] as number]
    );
    return [x, y];
  }
  const image = matrixVectorMultiply3(
    [
      entries[0] as number, entries[1] as number, entries[2] as number,
      entries[3] as number, entries[4] as number, entries[5] as number,
      entries[6] as number, entries[7] as number, entries[8] as number
    ],
    { x: vector[0] as number, y: vector[1] as number, z: vector[2] as number }
  );
  return [image.x, image.y, image.z];
}

/**
 * Analyze real/complex eigenstructure of a resolved 2×2/3×3 matrix.
 * Never throws; solver failure yields {unavailable: true}.
 */
export function analyzeEigen(entries: readonly number[], dimension: 2 | 3): EigenAnalysis {
  const empty: EigenAnalysis = { dimension, entries: [], realDirectionCount: 0, unavailable: true };
  if (entries.length !== dimension * dimension || !entries.every(Number.isFinite)) {
    return empty;
  }
  const rows: number[][] = [];
  for (let row = 0; row < dimension; row += 1) {
    rows.push(Array.from(entries.slice(row * dimension, row * dimension + dimension)));
  }
  let solved: { values: unknown; eigenvectors: Array<{ value: unknown; vector: unknown }> };
  try {
    const result = eigs(rows);
    const values = (result as { values?: unknown }).values;
    const eigenvectors = (result as { eigenvectors?: unknown }).eigenvectors;
    if (!Array.isArray(eigenvectors)) {
      return empty;
    }
    const extracted = values != null && typeof (values as { valueOf?: unknown }).valueOf === "function"
      ? ((values as { valueOf(): unknown }).valueOf() as unknown)
      : values;
    solved = {
      values: extracted,
      eigenvectors: eigenvectors as Array<{ value: unknown; vector: unknown }>
    };
  } catch {
    return empty;
  }
  const matrixNorm = frobeniusNorm(entries);
  const tolerance = residualTolerance(Number.isFinite(matrixNorm) ? matrixNorm : 0);
  const real: RealEigenpair[] = [];
  const complex: ComplexEigenvalue[] = [];
  const failed: FailedEigenpair[] = [];
  for (const candidate of solved.eigenvectors) {
    const vector = toNumberArray(
      candidate.vector != null && typeof (candidate.vector as { valueOf?: unknown }).valueOf === "function"
        ? ((candidate.vector as { valueOf(): unknown }).valueOf() as unknown)
        : candidate.vector
    );
    if (isComplexLike(candidate.value)) {
      if (Number.isFinite(candidate.value.re) && Number.isFinite(candidate.value.im)) {
        complex.push({ kind: "complex", value: { re: candidate.value.re, im: candidate.value.im } });
      }
      continue;
    }
    if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value) || !vector) {
      continue;
    }
    const eigenvalue: number = candidate.value;
    const magnitude = vectorMagnitude(vector);
    if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
      failed.push({ kind: "failed", value: eigenvalue, reason: "Solver returned a zero eigenvector." });
      continue;
    }
    const unit = vector.map((entry) => entry / (magnitude as number));
    const image = applyMatrix(entries, dimension, unit);
    if (!image) {
      failed.push({ kind: "failed", value: eigenvalue, reason: "Eigen residual is non-finite." });
      continue;
    }
    let residualSquared = 0;
    for (let index = 0; index < dimension; index += 1) {
      const delta = (image[index] as number) - eigenvalue * (unit[index] as number);
      residualSquared += delta * delta;
    }
    const residual = Math.sqrt(residualSquared);
    if (!Number.isFinite(residual) || residual > tolerance) {
      failed.push({ kind: "failed", value: eigenvalue, reason: "Eigen residual above tolerance." });
      continue;
    }
    real.push({ kind: "real", value: eigenvalue, vector: normalizeSign(unit), residual });
  }
  real.sort((a, b) => a.value - b.value);
  complex.sort((a, b) => a.value.re - b.value.re || a.value.im - b.value.im);
  failed.sort((a, b) => a.value - b.value);
  return {
    dimension,
    entries: [...real, ...complex, ...failed],
    realDirectionCount: real.length,
    unavailable: false
  };
}

/** Compact "a + bi" formatting for honest complex display (UI layer). */
export function formatComplexValue(value: ComplexValue): string {
  const re = Math.abs(value.re) < 0.00005 ? 0 : Math.round(value.re * 10000) / 10000;
  const im = Math.abs(value.im) < 0.00005 ? 0 : Math.round(value.im * 10000) / 10000;
  if (im === 0) {
    return `${re}`;
  }
  if (re === 0) {
    return im === 1 ? "i" : im === -1 ? "-i" : `${im}i`;
  }
  const imPart = im === 1 ? "i" : im === -1 ? "-i" : `${Math.abs(im)}i`;
  return `${re} ${im < 0 ? "-" : "+"} ${imPart}`;
}
