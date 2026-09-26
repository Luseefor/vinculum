import { describe, expect, it } from "vitest";
import {
  orientationOfDeterminant,
  resolveLinearTransform,
  transformedBasis2,
  transformedBasis3,
  transformedUnitCube,
  transformedUnitSquare
} from "@/lib/math/linearTransformResolve";

describe("transform resolver (S28 PART 34/36/11)", () => {
  it("resolves identity defaults and parameter expressions live", () => {
    const identity = resolveLinearTransform(
      { dimension: "2d", entries: { m11: "1", m12: "0", m21: "0", m22: "1" } },
      {}
    );
    expect(identity).toEqual({ status: "ok", dimension: 2, matrix: [1, 0, 0, 1] });
    const parametric = resolveLinearTransform(
      { dimension: "2d", entries: { m11: "a", m12: "0", m21: "0", m22: "1" } },
      { a: 2 }
    );
    expect(parametric).toMatchObject({ status: "ok", dimension: 2 });
    if (parametric.status === "ok") {
      expect(parametric.matrix[0]).toBe(2);
    }
    // Same compiled entries follow slider values without recompilation
    // concerns: evaluation is scope-driven.
    const moved = resolveLinearTransform(
      { dimension: "2d", entries: { m11: "a", m12: "0", m21: "0", m22: "1" } },
      { a: -1 }
    );
    if (moved.status === "ok") {
      expect(moved.matrix[0]).toBe(-1);
    }
  });

  it("rejects unsafe, spatial, empty, and non-finite entries", () => {
    expect(
      resolveLinearTransform({ dimension: "2d", entries: { m11: "sin(factorial(a))", m12: "0", m21: "0", m22: "1" } }, { a: 1 }).status
    ).toBe("invalid");
    expect(
      resolveLinearTransform({ dimension: "2d", entries: { m11: "x", m12: "0", m21: "0", m22: "1" } }, {}).status
    ).toBe("invalid");
    expect(
      resolveLinearTransform({ dimension: "2d", entries: { m11: "", m12: "0", m21: "0", m22: "1" } }, {}).status
    ).toBe("invalid");
    expect(
      resolveLinearTransform({ dimension: "2d", entries: { m11: "1/0", m12: "0", m21: "0", m22: "1" } }, {}).status
    ).toBe("invalid");
    expect(
      resolveLinearTransform({ dimension: "3d", entries: { m11: "1", m12: "0", m13: "0", m21: "0", m22: "1", m23: "0", m31: "0", m32: "0", m33: "1" } }, {}).status
    ).toBe("ok");
  });

  it("derives basis, squares, and cubes from columns (PART 15)", () => {
    expect(transformedBasis2([2, 1, 0, 1])).toEqual([[2, 0], [1, 1]]);
    expect(transformedBasis3([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([
      { x: 1, y: 4, z: 7 },
      { x: 2, y: 5, z: 8 },
      { x: 3, y: 6, z: 9 }
    ]);
    // A(0)=0 always (PART 47): first square/corner is the origin.
    expect(transformedUnitSquare([2, 1, 0, 1])[0]).toEqual([0, 0]);
    expect(transformedUnitCube([1, 0, 0, 0, 1, 0, 0, 0, 1])[0]).toEqual({ x: 0, y: 0, z: 0 });
    // Shear maps the unit square to a parallelogram through fixed corners.
    expect(transformedUnitSquare([1, 1, 0, 1])).toEqual([[0, 0], [1, 0], [2, 1], [1, 1]]);
  });

  it("reads orientation from the determinant (PART 23)", () => {
    expect(orientationOfDeterminant(2, false)).toBe("preserved");
    expect(orientationOfDeterminant(-1, false)).toBe("reversed");
    expect(orientationOfDeterminant(0, true)).toBe("collapsed");
    expect(orientationOfDeterminant(1e-15, true)).toBe("collapsed");
  });
});
