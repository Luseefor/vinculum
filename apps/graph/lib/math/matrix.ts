// S28 pure matrix kernel: square 2×2 / 3×3 linear algebra over plain
// numbers. No Three.js (no THREE.Matrix3/4 anywhere here), no camera, no
// workers, no DOM. Renderer conversions live at the renderer boundary.
//
// STORAGE CONTRACT (PART 1): row-major flat tuples —
//   Matrix2 = [a11,a12, a21,a22]
//   Matrix3 = [a11,a12,a13, a21,a22,a23, a31,a32,a33]
// so A*v uses normal mathematical row-by-column semantics and Ae1 is the
// first COLUMN. One convention everywhere; do not mix.
//
// NUMERIC POLICY (PART 3): centralized scale-aware thresholds keyed to
// MATRIX scale (Frobenius norm / original max-abs entry), never bare
// absolute cutoffs:
// - singularity: |det| <= REL * norm^dim (purely relative past the
//   all-near-zero guard, so 1e8*I and 1e-8*I both classify invertible).
// - rank: Gaussian elimination with partial pivoting; pivots accepted
//   against REL * (original max-abs entry).
// - near-singular [1 1; 1 1+ε]: invertible iff ε clearly above ~4e-9
//   (characterized in tests).

import type { MathVector3 } from "./coordinates";

export type Matrix2 = readonly [number, number, number, number];
export type Matrix3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number
];

export const MATRIX_ABS_TOL = 1e-12;
export const MATRIX_REL_TOL = 1e-9;

export function finiteMatrix(entries: readonly number[]): boolean {
  return entries.every(Number.isFinite);
}

export function identity2(): Matrix2 {
  return [1, 0, 0, 1];
}

export function identity3(): Matrix3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

export function transpose2(a: Matrix2): Matrix2 {
  return [a[0], a[2], a[1], a[3]];
}

export function transpose3(a: Matrix3): Matrix3 {
  return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
}

export function trace2(a: Matrix2): number {
  return a[0] + a[3];
}

export function trace3(a: Matrix3): number {
  return a[0] + a[4] + a[8];
}

/** Frobenius norm: the matrix scale metric for singularity/rank/eigen. */
export function frobeniusNorm(entries: readonly number[]): number {
  let sum = 0;
  for (const entry of entries) {
    sum += entry * entry;
  }
  return Math.sqrt(sum);
}

/** Max-abs entry: pivot acceptance scale for rank elimination. */
export function maxAbsEntry(entries: readonly number[]): number {
  let peak = 0;
  for (const entry of entries) {
    const magnitude = Math.abs(entry);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

/** Row-by-column matrix-vector product (A*v, v as column). */
export function matrixVectorMultiply2(a: Matrix2, v: readonly [number, number]): [number, number] {
  return [a[0] * v[0] + a[1] * v[1], a[2] * v[0] + a[3] * v[1]];
}

/** Row-by-column matrix-vector product (A*v, v as column). */
export function matrixVectorMultiply3(a: Matrix3, v: MathVector3): MathVector3 {
  return {
    x: a[0] * v.x + a[1] * v.y + a[2] * v.z,
    y: a[3] * v.x + a[4] * v.y + a[5] * v.z,
    z: a[6] * v.x + a[7] * v.y + a[8] * v.z
  };
}

/**
 * Matrix-matrix product C = A*B (apply B first, then A — PART 58).
 * Pure foundation for future composition; no UI in S28.
 */
export function matrixMultiply2(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3]
  ];
}

/**
 * Matrix-matrix product C = A*B (apply B first, then A — PART 58).
 * Pure foundation for future composition; no UI in S28.
 */
export function matrixMultiply3(a: Matrix3, b: Matrix3): Matrix3 {
  const out = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out as unknown as Matrix3;
}

export function determinant2(a: Matrix2): number {
  return a[0] * a[3] - a[1] * a[2];
}

export function determinant3(a: Matrix3): number {
  return (
    a[0] * (a[4] * a[8] - a[5] * a[7]) -
    a[1] * (a[3] * a[8] - a[5] * a[6]) +
    a[2] * (a[3] * a[7] - a[4] * a[6])
  );
}

/**
 * Scale-aware singularity (PART 3): |det| <= REL * norm^dim. Purely
 * relative (after the all-near-zero guard) so 1e8*I and 1e-8*I both
 * classify invertible — an absolute floor would misclassify tiny but
 * perfectly conditioned matrices as singular. S28-R1.
 */
export function isSingular(entries: readonly number[], dimension: 2 | 3, determinant: number): boolean {
  if (!Number.isFinite(determinant)) {
    return true;
  }
  const norm = frobeniusNorm(entries);
  if (!Number.isFinite(norm) || norm <= MATRIX_ABS_TOL) {
    return true;
  }
  const scale = Math.pow(norm, dimension);
  if (!Number.isFinite(scale)) {
    return true;
  }
  return Math.abs(determinant) <= MATRIX_REL_TOL * scale;
}

/**
 * Numeric rank via Gaussian elimination with partial pivoting (PART 6).
 * Pivot acceptance is relative to the ORIGINAL max-abs entry, so
 * 1e8*I ranks full and tiny-but-conditioned matrices are not crushed.
 * det != 0 implies full rank, but deficient cases resolve 2/1/0 here.
 */
export function matrixRank(entries: readonly number[], dimension: 2 | 3): number {
  const n = dimension;
  const peak = maxAbsEntry(entries);
  if (!(peak > 0) || !Number.isFinite(peak)) {
    return 0;
  }
  const pivotTol = MATRIX_REL_TOL * peak;
  // Work on a mutable row-major copy.
  const rows: number[][] = [];
  for (let row = 0; row < n; row += 1) {
    rows.push(Array.from(entries.slice(row * n, row * n + n)));
  }
  let rank = 0;
  for (let col = 0; col < n; col += 1) {
    // Largest-magnitude available pivot at or below the diagonal.
    let pivotRow = -1;
    let pivotMagnitude = 0;
    for (let row = rank; row < n; row += 1) {
      const magnitude = Math.abs(rows[row]?.[col] ?? 0);
      if (magnitude > pivotMagnitude) {
        pivotMagnitude = magnitude;
        pivotRow = row;
      }
    }
    if (pivotRow === -1 || pivotMagnitude <= pivotTol) {
      continue;
    }
    if (pivotRow !== rank) {
      const swap = rows[rank] as number[];
      rows[rank] = rows[pivotRow] as number[];
      rows[pivotRow] = swap;
    }
    const pivot = rows[rank]?.[col] ?? 0;
    for (let row = rank + 1; row < n; row += 1) {
      const factor = (rows[row]?.[col] ?? 0) / pivot;
      for (let k = col; k < n; k += 1) {
        rows[row]![k] = (rows[row]?.[k] ?? 0) - factor * (rows[rank]?.[k] ?? 0);
      }
    }
    rank += 1;
  }
  return rank;
}

/** 2×2 closed-form inverse; null when singular (never Infinity/NaN). */
export function inverse2(a: Matrix2): Matrix2 | null {
  const det = determinant2(a);
  if (isSingular(a, 2, det) || det === 0) {
    return null;
  }
  return [a[3] / det, -a[1] / det, -a[2] / det, a[0] / det];
}

/** 3×3 adjugate/determinant inverse; null when singular. */
export function inverse3(a: Matrix3): Matrix3 | null {
  const det = determinant3(a);
  if (isSingular(a, 3, det) || det === 0) {
    return null;
  }
  const invDet = 1 / det;
  return [
    (a[4] * a[8] - a[5] * a[7]) * invDet,
    (a[2] * a[7] - a[1] * a[8]) * invDet,
    (a[1] * a[5] - a[2] * a[4]) * invDet,
    (a[5] * a[6] - a[3] * a[8]) * invDet,
    (a[0] * a[8] - a[2] * a[6]) * invDet,
    (a[2] * a[3] - a[0] * a[5]) * invDet,
    (a[3] * a[7] - a[4] * a[6]) * invDet,
    (a[1] * a[6] - a[0] * a[7]) * invDet,
    (a[0] * a[4] - a[1] * a[3]) * invDet
  ];
}

/** Element-wise comparison within absolute tolerance (test helper). */
export function approximatelyEqualMatrix(
  a: readonly number[],
  b: readonly number[],
  tolerance = 1e-9
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (!Number.isFinite(a[index] as number) || !Number.isFinite(b[index] as number)) {
      return false;
    }
    if (Math.abs((a[index] as number) - (b[index] as number)) > tolerance) {
      return false;
    }
  }
  return true;
}

/** First matrix column = Ae1 (PART 15 basis semantics). */
export function basisColumn2(a: Matrix2, index: 0 | 1): [number, number] {
  return index === 0 ? [a[0], a[2]] : [a[1], a[3]];
}

/** Matrix column = Ae_i (PART 15 basis semantics). */
export function basisColumn3(a: Matrix3, index: 0 | 1 | 2): MathVector3 {
  return { x: a[index] as number, y: a[3 + index] as number, z: a[6 + index] as number };
}

/** Signed shoelace area of a 2D quadrilateral (PART 49 cross-check). */
export function shoelaceArea(points: ReadonlyArray<readonly [number, number]>): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] as readonly [number, number];
    const next = points[(index + 1) % points.length] as readonly [number, number];
    sum += current[0] * next[1] - next[0] * current[1];
  }
  return sum / 2;
}

/** Scalar triple product u·(v×w) (PART 49 3D cross-check). */
export function scalarTripleProduct(u: MathVector3, v: MathVector3, w: MathVector3): number {
  return (
    u.x * (v.y * w.z - v.z * w.y) +
    u.y * (v.z * w.x - v.x * w.z) +
    u.z * (v.x * w.y - v.y * w.x)
  );
}
