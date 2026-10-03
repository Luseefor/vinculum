// S28 linearTransform resolver + derived geometry. One resolver feeds
// the renderer, the Inspector, and vector analysis alike (PART 36):
// canonical object + explicit params -> resolved Matrix2/3 or a
// structured diagnostic. Entry compilation reuses compileGeometryCoordinate
// (PART 11: scalar constants/pi/e/params, no spatial locals, S11
// plumbing intact — no second compiler). Resolved matrices are runtime
// only; raw strings persist byte-exact.

import { compileGeometryCoordinate } from "./compileGeometryCoordinate";
import {
  basisColumn2,
  basisColumn3,
  finiteMatrix,
  matrixVectorMultiply2,
  matrixVectorMultiply3,
  type Matrix2,
  type Matrix3
} from "./matrix";
import type { MathVector3 } from "./coordinates";

export type ResolvedTransform =
  | { status: "ok"; dimension: 2; matrix: Matrix2 }
  | { status: "ok"; dimension: 3; matrix: Matrix3 }
  | { status: "invalid"; reason: string };

export interface LinearTransformLike {
  dimension: "2d" | "3d";
  entries: Record<string, string>;
}

const ENTRY_FIELDS_2D = ["m11", "m12", "m21", "m22"] as const;
const ENTRY_FIELDS_3D = ["m11", "m12", "m13", "m21", "m22", "m23", "m31", "m32", "m33"] as const;

export function transformEntryFields(dimension: "2d" | "3d"): readonly string[] {
  return dimension === "2d" ? ENTRY_FIELDS_2D : ENTRY_FIELDS_3D;
}

export function resolveLinearTransform(
  object: LinearTransformLike,
  params: Record<string, number>
): ResolvedTransform {
  const fields = transformEntryFields(object.dimension);
  const values: number[] = [];
  for (const field of fields) {
    const expression = object.entries[field];
    if (typeof expression !== "string" || !expression.trim()) {
      return { status: "invalid", reason: `Matrix entry ${field} cannot be empty.` };
    }
    const compiled = compileGeometryCoordinate(expression, params);
    if (compiled.error) {
      return { status: "invalid", reason: `Matrix entry ${field}: ${compiled.error}` };
    }
    const value = compiled.evaluate(params);
    if (!Number.isFinite(value)) {
      return { status: "invalid", reason: `Matrix entry ${field} is non-finite.` };
    }
    values.push(value);
  }
  if (!finiteMatrix(values)) {
    return { status: "invalid", reason: "Matrix entries are non-finite." };
  }
  if (object.dimension === "2d") {
    return {
      status: "ok",
      dimension: 2,
      matrix: [values[0] as number, values[1] as number, values[2] as number, values[3] as number]
    };
  }
  return {
    status: "ok",
    dimension: 3,
    matrix: [
      values[0] as number, values[1] as number, values[2] as number,
      values[3] as number, values[4] as number, values[5] as number,
      values[6] as number, values[7] as number, values[8] as number
    ]
  };
}

/** Transformed basis columns Ae1.. (PART 15: columns, never rows). */
export function transformedBasis2(matrix: Matrix2): Array<[number, number]> {
  return [basisColumn2(matrix, 0), basisColumn2(matrix, 1)];
}

/** Transformed basis columns Ae1..Ae3 (PART 15: columns, never rows). */
export function transformedBasis3(matrix: Matrix3): MathVector3[] {
  return [basisColumn3(matrix, 0), basisColumn3(matrix, 1), basisColumn3(matrix, 2)];
}

/** Unit-square corners mapped through A (PART 13). */
export function transformedUnitSquare(matrix: Matrix2): Array<[number, number]> {
  const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return corners.map(([x, y]) => matrixVectorMultiply2(matrix, [x, y]));
}

/** Unit-cube corners mapped through A (PART 15). */
export function transformedUnitCube(matrix: Matrix3): MathVector3[] {
  const corners: MathVector3[] = [];
  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      for (const z of [0, 1]) {
        corners.push(matrixVectorMultiply3(matrix, { x, y, z }));
      }
    }
  }
  return corners;
}

/** Orientation reading from a determinant (PART 23). */
export function orientationOfDeterminant(determinant: number, singular: boolean): "preserved" | "reversed" | "collapsed" {
  if (singular || determinant === 0) {
    return "collapsed";
  }
  return determinant > 0 ? "preserved" : "reversed";
}
