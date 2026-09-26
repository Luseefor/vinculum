import { describe, expect, it } from "vitest";
import {
  approximatelyEqualMatrix,
  basisColumn2,
  basisColumn3,
  determinant2,
  determinant3,
  frobeniusNorm,
  identity2,
  identity3,
  inverse2,
  inverse3,
  isSingular,
  matrixMultiply2,
  matrixMultiply3,
  matrixRank,
  matrixVectorMultiply2,
  matrixVectorMultiply3,
  maxAbsEntry,
  scalarTripleProduct,
  shoelaceArea,
  trace2,
  trace3,
  transpose2,
  transpose3,
  type Matrix2,
  type Matrix3
} from "@/lib/math/matrix";

describe("matrix arithmetic (S28 PART 2/56)", () => {
  it("multiplies A*v row-by-column: [[1..9]]·<1,0,-1> = <-2,-2,-2>", () => {
    const a: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(matrixVectorMultiply3(a, { x: 1, y: 0, z: -1 })).toEqual({ x: -2, y: -2, z: -2 });
    const b: Matrix2 = [2, 1, 0, 1];
    expect(matrixVectorMultiply2(b, [1, 1])).toEqual([3, 1]);
  });

  it("multiplies asymmetrically with A(BC)=(AB)C and documents order", () => {
    const a: Matrix2 = [1, 2, 3, 4];
    const b: Matrix2 = [2, 0, 1, 2];
    const c: Matrix2 = [0, 1, 1, 0];
    // C = A*B means apply B first, then A (PART 58).
    expect(matrixMultiply2(a, b)).toEqual([4, 4, 10, 8]);
    const left = matrixMultiply2(matrixMultiply2(a, b), c);
    const right = matrixMultiply2(a, matrixMultiply2(b, c));
    expect(approximatelyEqualMatrix(left, right, 1e-12)).toBe(true);
    const a3: Matrix3 = [1, 2, 0, 0, 1, 3, 1, 0, 1];
    const b3: Matrix3 = [0, 1, 1, 1, 0, 2, 0, 1, 0];
    const c3: Matrix3 = [2, 0, 1, 1, 1, 0, 0, 2, 1];
    expect(
      approximatelyEqualMatrix(matrixMultiply3(matrixMultiply3(a3, b3), c3), matrixMultiply3(a3, matrixMultiply3(b3, c3)), 1e-12)
    ).toBe(true);
  });

  it("transposes, traces, and honors identity", () => {
    expect(transpose2([1, 2, 3, 4])).toEqual([1, 3, 2, 4]);
    expect(transpose3([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
    expect(trace2([1, 2, 3, 4])).toBe(5);
    expect(trace3([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(15);
    const a: Matrix2 = [2, 1, 0, 1];
    expect(matrixMultiply2(identity2(), a)).toEqual([2, 1, 0, 1]);
    expect(matrixMultiply2(a, identity2())).toEqual([2, 1, 0, 1]);
    expect(matrixVectorMultiply2(identity2(), [5, -3])).toEqual([5, -3]);
    const b: Matrix3 = [1, 2, 3, 0, 1, 4, 5, 6, 0];
    expect(approximatelyEqualMatrix(matrixMultiply3(identity3(), b), [...b], 1e-12)).toBe(true);
    expect(approximatelyEqualMatrix(matrixMultiply3(b, identity3()), [...b], 1e-12)).toBe(true);
  });

  it("reads basis columns (Ae1 = first column)", () => {
    const a: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(basisColumn3(a, 0)).toEqual({ x: 1, y: 4, z: 7 });
    expect(basisColumn3(a, 1)).toEqual({ x: 2, y: 5, z: 8 });
    expect(basisColumn3(a, 2)).toEqual({ x: 3, y: 6, z: 9 });
    expect(basisColumn2([2, 1, 0, 1], 0)).toEqual([2, 0]);
    expect(basisColumn2([2, 1, 0, 1], 1)).toEqual([1, 1]);
  });

  it("fixes points and origin under every linear map (PART 47)", () => {
    const a: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(matrixVectorMultiply3(a, { x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(matrixVectorMultiply2([2, 1, 0, 1], [0, 0])).toEqual([0, 0]);
  });
});

describe("determinant (S28 PART 4)", () => {
  it("pins identity, swap, scaling, singular, asymmetric cases", () => {
    expect(determinant2([1, 0, 0, 1])).toBe(1);
    expect(determinant2([0, 1, 1, 0])).toBe(-1);
    expect(determinant3([2, 0, 0, 0, 3, 0, 0, 0, 4])).toBe(24);
    expect(determinant2([1, 2, 2, 4])).toBe(0);
    expect(determinant3([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(0);
    expect(determinant2([2, 1, 0, 1])).toBe(2);
    expect(determinant3([1, 1, 0, 0, 2, 0, 0, 0, 3])).toBe(6);
  });

  it("links |det| to shoelace area and triple-product volume (PART 49)", () => {
    const a: Matrix2 = [2, 1, 0, 1];
    const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const mapped = corners.map(([x, y]) => matrixVectorMultiply2(a, [x, y]));
    expect(Math.abs(shoelaceArea(mapped))).toBeCloseTo(Math.abs(determinant2(a)), 12);
    const b: Matrix3 = [1, 1, 0, 0, 2, 0, 0, 0, 3];
    const c1 = basisColumn3(b, 0);
    const c2 = basisColumn3(b, 1);
    const c3 = basisColumn3(b, 2);
    expect(Math.abs(scalarTripleProduct(c1, c2, c3))).toBeCloseTo(Math.abs(determinant3(b)), 9);
  });
});

describe("rank (S28 PART 6)", () => {
  it("resolves 3/2/1/0 in 3D and 2/1/0 in 2D", () => {
    expect(matrixRank([1, 0, 0, 0, 1, 0, 0, 0, 1], 3)).toBe(3);
    expect(matrixRank([1, 0, 0, 0, 1, 0, 0, 0, 0], 3)).toBe(2);
    expect(matrixRank([1, 2, 3, 2, 4, 6, 3, 6, 9], 3)).toBe(1);
    expect(matrixRank([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)).toBe(0);
    expect(matrixRank([1, 0, 0, 1], 2)).toBe(2);
    expect(matrixRank([1, 2, 2, 4], 2)).toBe(1);
    expect(matrixRank([0, 0, 0, 0], 2)).toBe(0);
  });

  it("stays coherent at 1e-8 and 1e8 scales (PART 57)", () => {
    expect(matrixRank([1e-8, 0, 0, 1e-8], 2)).toBe(2);
    expect(matrixRank([1e8, 0, 0, 1e8], 2)).toBe(2);
    expect(matrixRank([1e-8, 0, 0, 0, 1e-8, 0, 0, 0, 1e-8], 3)).toBe(3);
    expect(isSingular([1e-8, 0, 0, 1e-8], 2, determinant2([1e-8, 0, 0, 1e-8]))).toBe(false);
    expect(isSingular([1e8, 0, 0, 1e8], 2, determinant2([1e8, 0, 0, 1e8]))).toBe(false);
  });

  it("characterizes the near-singular threshold (PART 57)", () => {
    // det = ε against norm² ≈ 4: ε=1e-7 invertible, ε=1e-12 singular.
    expect(isSingular([1, 1, 1, 1 + 1e-7], 2, 1e-7)).toBe(false);
    expect(isSingular([1, 1, 1, 1 + 1e-12], 2, 1e-12)).toBe(true);
    expect(matrixRank([1, 1, 1, 1 + 1e-7], 2)).toBe(2);
    expect(matrixRank([1, 1, 1, 1 + 1e-12], 2)).toBe(1);
  });

  it("exposes norm helpers", () => {
    expect(frobeniusNorm([3, 4])).toBe(5);
    expect(maxAbsEntry([1, -7, 3])).toBe(7);
  });
});

describe("inverse (S28 PART 7/50)", () => {
  it("inverts asymmetric 2D with A·A^-1 ≈ I and involution", () => {
    const a: Matrix2 = [2, 1, 0, 1];
    const inv = inverse2(a);
    expect(inv).not.toBeNull();
    expect(approximatelyEqualMatrix(matrixMultiply2(a, inv as Matrix2), [1, 0, 0, 1], 1e-12)).toBe(true);
    expect(approximatelyEqualMatrix(inverse2(inv as Matrix2) as Matrix2, a, 1e-12)).toBe(true);
    const v: [number, number] = [3, -2];
    const roundTrip = matrixVectorMultiply2(inv as Matrix2, matrixVectorMultiply2(a, v));
    expect(Math.abs(roundTrip[0] - v[0]) < 1e-9 && Math.abs(roundTrip[1] - v[1]) < 1e-9).toBe(true);
  });

  it("inverts asymmetric 3D with A·A^-1 ≈ I and involution", () => {
    const a: Matrix3 = [1, 2, 3, 0, 1, 4, 5, 6, 0];
    expect(determinant3(a)).toBe(1);
    const inv = inverse3(a);
    expect(inv).not.toBeNull();
    expect(approximatelyEqualMatrix(matrixMultiply3(a, inv as Matrix3), [...identity3()], 1e-9)).toBe(true);
    expect(approximatelyEqualMatrix(inverse3(inv as Matrix3) as Matrix3, [...a], 1e-9)).toBe(true);
    const v = { x: 1, y: -2, z: 3 };
    const roundTrip = matrixVectorMultiply3(inv as Matrix3, matrixVectorMultiply3(a, v));
    expect(Math.hypot(roundTrip.x - v.x, roundTrip.y - v.y, roundTrip.z - v.z)).toBeLessThan(1e-9);
  });

  it("returns null for singular matrices (never Infinity/NaN)", () => {
    expect(inverse2([1, 2, 2, 4])).toBeNull();
    expect(inverse2([0, 0, 0, 0])).toBeNull();
    expect(inverse3([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeNull();
    expect(inverse3([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});
