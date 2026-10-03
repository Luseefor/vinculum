import { describe, expect, it } from "vitest";
import {
  compileVectorFieldDifferential,
  evaluateVectorDifferential,
  isFieldPointInDomain,
  vectorCurl3D,
  vectorCurlScalar2D,
  vectorDivergence,
  type EvaluatedJacobian
} from "@/lib/math/vectorCalculus";
import type { VectorFieldDimension } from "@vinculum/scene/types";

function analyze(
  dimension: VectorFieldDimension,
  pExpr: string,
  qExpr: string,
  rExpr: string,
  point: { x: number; y: number; z?: number },
  params: Record<string, number> = {}
): EvaluatedJacobian {
  const compiled = compileVectorFieldDifferential(dimension, pExpr, qExpr, rExpr, params);
  return evaluateVectorDifferential(compiled, point, params);
}

function expectMatrix(actual: EvaluatedJacobian, expected: (number | null)[][]) {
  expect(actual.values).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual.values[i]).toHaveLength(expected[i]!.length);
    for (let j = 0; j < expected[i]!.length; j += 1) {
      const want = expected[i]![j];
      const got = actual.values[i]![j];
      if (want === null) {
        expect(got).toBeNull();
      } else {
        expect(got).toBeCloseTo(want, 10);
      }
    }
  }
}

describe("vector calculus core (S22 PART 25)", () => {
  it("2D radial F=<x,y>: J=I, div=2, scalar curl=0", () => {
    const jacobian = analyze("2d", "x", "y", "", { x: 4, y: -2 });
    expectMatrix(jacobian, [
      [1, 0],
      [0, 1]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(2, 12);
    expect(vectorCurlScalar2D(jacobian)).toBeCloseTo(0, 12);
  });

  it("2D rotation F=<-y,x>: J=[[0,-1],[1,0]], div=0, scalar curl=2", () => {
    const jacobian = analyze("2d", "-y", "x", "", { x: 1, y: 2 });
    expectMatrix(jacobian, [
      [0, -1],
      [1, 0]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(0, 12);
    expect(vectorCurlScalar2D(jacobian)).toBeCloseTo(2, 12);
  });

  it("2D saddle F=<x,-y>: div=0, scalar curl=0", () => {
    const jacobian = analyze("2d", "x", "-y", "", { x: 3, y: 3 });
    expectMatrix(jacobian, [
      [1, 0],
      [0, -1]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(0, 12);
    expect(vectorCurlScalar2D(jacobian)).toBeCloseTo(0, 12);
  });

  it("3D radial F=<x,y,z>: J=I, div=3, curl=<0,0,0> at every point", () => {
    for (const point of [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
      { x: -4, y: 0.5, z: 7 }
    ]) {
      const jacobian = analyze("3d", "x", "y", "z", point);
      expectMatrix(jacobian, [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]);
      expect(vectorDivergence(jacobian)).toBeCloseTo(3, 12);
      expect(vectorCurl3D(jacobian)).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("3D rotation F=<-y,x,0>: div=0, curl=<0,0,2>", () => {
    const jacobian = analyze("3d", "-y", "x", "0", { x: 1, y: 1, z: 5 });
    expectMatrix(jacobian, [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 0]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(0, 12);
    expect(vectorCurl3D(jacobian)).toEqual({ x: 0, y: 0, z: 2 });
  });
});

describe("asymmetric 3D field (S22 PART 26)", () => {
  it("F=<x*y, y*z, z*x> at (1,2,3): div=6, curl=<-2,-3,-1>", () => {
    // J = [[y,x,0],[0,z,y],[z,0,x]]; div = y+z+x; curl = <Ry-Qz, Pz-Rx, Qx-Py> = <0-y, 0-z, 0-x>.
    const jacobian = analyze("3d", "x*y", "y*z", "z*x", { x: 1, y: 2, z: 3 });
    expectMatrix(jacobian, [
      [2, 1, 0],
      [0, 3, 2],
      [3, 0, 1]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(6, 10);
    expect(vectorCurl3D(jacobian)).toEqual({ x: -2, y: -3, z: -1 });
  });

  it("field with three distinct curl components", () => {
    // F=<y^2, z^2, x^2>: curl = <-2z, -2x, -2y>; at (1,2,3): <-6,-2,-4>.
    const jacobian = analyze("3d", "y^2", "z^2", "x^2", { x: 1, y: 2, z: 3 });
    expect(vectorDivergence(jacobian)).toBeCloseTo(0, 12);
    const curl = vectorCurl3D(jacobian);
    expect(curl?.x).toBeCloseTo(-6, 10);
    expect(curl?.y).toBeCloseTo(-2, 10);
    expect(curl?.z).toBeCloseTo(-4, 10);
  });
});

describe("parameters (S22 PART 27)", () => {
  it("F=<a*x, b*y, c*z>: J=diag(a,b,c), div=a+b+c, curl=0", () => {
    const params = { a: 2, b: 3, c: 5 };
    const jacobian = analyze("3d", "a*x", "b*y", "c*z", { x: 7, y: -1, z: 0.5 }, params);
    expectMatrix(jacobian, [
      [2, 0, 0],
      [0, 3, 0],
      [0, 0, 5]
    ]);
    expect(vectorDivergence(jacobian)).toBeCloseTo(10, 10);
    expect(vectorCurl3D(jacobian)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("evaluates fresh parameter values without recompiling the math", () => {
    const compiled = compileVectorFieldDifferential("3d", "a*x", "b*y", "c*z", { a: 1, b: 1, c: 1 });
    const at = (params: Record<string, number>) =>
      evaluateVectorDifferential(compiled, { x: 0, y: 0, z: 0 }, params);
    expect(vectorDivergence(at({ a: 1, b: 1, c: 1 }))).toBeCloseTo(3, 12);
    expect(vectorDivergence(at({ a: 4, b: 5, c: 6 }))).toBeCloseTo(15, 12);
  });
});

describe("partial availability (S22 PART 24)", () => {
  it("marks one bad entry unavailable without inventing values", () => {
    // Pz = d/dz tan(z) needs sec: unavailable. div = Px+Qy+Rz survives
    // (all diagonal entries valid); cy needs Pz and goes unavailable.
    const jacobian = analyze("3d", "x+tan(z)", "y", "z", { x: 1, y: 2, z: 0.5 });
    expect(jacobian.values[0]![0]).toBeCloseTo(1, 12);
    expect(jacobian.values[0]![2]).toBeNull();
    expect(vectorDivergence(jacobian)).toBeCloseTo(3, 12);
    const curl = vectorCurl3D(jacobian);
    expect(curl?.x).toBeCloseTo(0, 12);
    expect(curl?.y).toBeNull();
    expect(curl?.z).toBeCloseTo(0, 12);
  });

  it("poisons reserved locals instead of binding them", () => {
    // d/dx(x*t) = t by the product rule; t is reserved, so the poisoned
    // scope evaluates it unavailable rather than binding an ambient value.
    // div needs Px → unavailable, but the curl (needing only other
    // entries) still computes: partial availability, not all-or-nothing.
    const jacobian = analyze("3d", "x*t", "y", "z", { x: 1, y: 2, z: 3 });
    expect(jacobian.values[0]![0]).toBeNull();
    expect(vectorDivergence(jacobian)).toBeNull();
    expect(vectorCurl3D(jacobian)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("reports non-finite derivatives as unavailable without crashing", () => {
    // P=sqrt(x): d/dx = 1/(2*sqrt(x)); at x=0 the derivative blows up.
    const jacobian = analyze("3d", "sqrt(x)", "y", "z", { x: 0, y: 1, z: 2 });
    expect(jacobian.values[0]![0]).toBeNull();
    expect(vectorDivergence(jacobian)).toBeNull();
  });

  it("keeps unsupported derivatives isolated from the source field", () => {
    // tan differentiates to sec (unsupported): the entry is unavailable,
    // but sibling entries and their operators still compute.
    const jacobian = analyze("2d", "tan(x)", "y", "", { x: 0.5, y: 1 });
    expect(jacobian.values[0]![0]).toBeNull();
    expect(jacobian.values[1]![1]).toBeCloseTo(1, 12);
  });
});

describe("field domain containment (S22 PART 6/34)", () => {
  it("accepts interior points and rejects exterior ones", () => {
    const domain2D = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    expect(isFieldPointInDomain("2d", domain2D, { x: 0, y: 0, z: 99 })).toBe(true);
    expect(isFieldPointInDomain("2d", domain2D, { x: 5, y: -5 })).toBe(true);
    expect(isFieldPointInDomain("2d", domain2D, { x: 5.001, y: 0 })).toBe(false);
    expect(isFieldPointInDomain("2d", domain2D, { x: NaN, y: 0 })).toBe(false);
  });

  it("requires z containment for 3D fields", () => {
    const domain3D = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -1, zMax: 1 };
    expect(isFieldPointInDomain("3d", domain3D, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(isFieldPointInDomain("3d", domain3D, { x: 0, y: 0, z: 1.5 })).toBe(false);
    expect(isFieldPointInDomain("3d", domain3D, { x: 0, y: 0 })).toBe(false);
  });

  it("treats calculus in canonical x/y regardless of view plane (PART 35)", () => {
    // A 2D field is mathematically F(x,y) even when the viewport shows
    // xz/yz pairs: the domain check never reinterprets axes.
    const domain2D = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    expect(isFieldPointInDomain("2d", domain2D, { x: 0.5, y: 0.5 })).toBe(true);
    expect(isFieldPointInDomain("2d", domain2D, { x: 2, y: 0.5 })).toBe(false);
  });
});
