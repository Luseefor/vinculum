import { describe, expect, it } from "vitest";
import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  compileScalarGradient,
  evaluateSurfaceGradient,
  GRADIENT_ZERO_EPS,
  isAnalysisPointOnSurface,
  normalizeSurfaceLevelSet,
  surfaceSampleSpacing,
  tangentBasisFromNormal,
  tangentPlaneFromGradient,
  type SurfaceLevelSet
} from "@/lib/math/surfaceDifferential";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";

function makeSurface(equation: string, orientation?: "x" | "y" | "z"): SurfaceGraphObject {
  return {
    id: "s-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 80,
    appearance: { wireframe: false },
    orientation
  };
}

function makeImplicit(equation: string): ImplicitSurfaceObject {
  return {
    id: "i-1",
    kind: "implicitSurface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
    resolution: 32,
    appearance: { wireframe: false }
  };
}

function gradientOf(
  object: SurfaceGraphObject | ImplicitSurfaceObject,
  point: { x: number; y: number; z: number },
  params: Record<string, number> = {}
) {
  const levelSet = normalizeSurfaceLevelSet(object);
  if ("error" in levelSet) {
    throw new Error(`level set failed: ${levelSet.error}`);
  }
  const compiled = compileScalarGradient(levelSet as SurfaceLevelSet, params);
  expect(compiled.error).toBeNull();
  const result = evaluateSurfaceGradient(compiled, point, params);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("gradient unavailable");
  }
  return result.gradient;
}

describe("normalizeSurfaceLevelSet (S21 Slice 2)", () => {
  it("normalizes z = f(x,y) with x/y independents", () => {
    const levelSet = normalizeSurfaceLevelSet(makeSurface("z = x^2 + 2*y^2"));
    expect(levelSet).toEqual({ kind: "explicit", orientation: "z", body: "x^2 + 2*y^2", independentVars: ["x", "y"] });
  });

  it("normalizes x- and y-orientations without hardcoding z", () => {
    expect(normalizeSurfaceLevelSet(makeSurface("x = y^2 + 3*z", "x"))).toMatchObject({
      kind: "explicit",
      orientation: "x",
      independentVars: ["y", "z"]
    });
    expect(normalizeSurfaceLevelSet(makeSurface("y = x*z + 2*x", "y"))).toMatchObject({
      kind: "explicit",
      orientation: "y",
      independentVars: ["x", "z"]
    });
  });

  it("normalizes implicit equality and bare fields, rejects chained equality", () => {
    expect(normalizeSurfaceLevelSet(makeImplicit("x^2+y^2+z^2=1"))).toEqual({
      kind: "implicit",
      lhs: "x^2+y^2+z^2",
      rhs: "1"
    });
    expect(normalizeSurfaceLevelSet(makeImplicit("x^2+y^2+z^2-1"))).toEqual({
      kind: "implicit",
      lhs: "x^2+y^2+z^2-1",
      rhs: "0"
    });
    expect(normalizeSurfaceLevelSet(makeImplicit("x = y = 1"))).toHaveProperty("error");
    expect(normalizeSurfaceLevelSet(makeImplicit(""))).toHaveProperty("error");
  });
});

describe("explicit surface analysis (S21 PART 11)", () => {
  it("z = x^2 + 2y^2 at (1,2,9): fx=2, fy=8, normal <-2,-8,1>", () => {
    const gradient = gradientOf(makeSurface("z = x^2 + 2*y^2"), { x: 1, y: 2, z: 9 });
    expect(gradient.x).toBeCloseTo(-2, 12);
    expect(gradient.y).toBeCloseTo(-8, 12);
    expect(gradient.z).toBeCloseTo(1, 12);

    const plane = tangentPlaneFromGradient({ x: 1, y: 2, z: 9 }, gradient);
    expect(plane.ok).toBe(true);
    if (!plane.ok) return;
    // Plane: -2(x-1) - 8(y-2) + (z-9) = 0, equivalently z = 2x + 8y - 9.
    expect(plane.plane.normal).toEqual(gradient);
    const { unitNormal } = plane.plane;
    const length = Math.sqrt(unitNormal.x ** 2 + unitNormal.y ** 2 + unitNormal.z ** 2);
    expect(length).toBeCloseTo(1, 12);
    // Independent plane-constant check: d = -(n·p) = -(-2-16+9) = 9.
    const constant =
      -(gradient.x * 1 + gradient.y * 2 + gradient.z * 9);
    expect(constant).toBeCloseTo(9, 12);
    // Basis orthogonal to the normal and to each other, unit length.
    const { basisT1, basisT2 } = plane.plane;
    // Least-aligned axis is z: t1 = normalize(cross(n, z)) = (-8,2,0)/√68.
    expect(basisT1.x).toBeCloseTo(-8 / Math.sqrt(68), 12);
    expect(basisT1.y).toBeCloseTo(2 / Math.sqrt(68), 12);
    expect(basisT1.z).toBeCloseTo(0, 12);
    expect(basisT1.x * unitNormal.x + basisT1.y * unitNormal.y + basisT1.z * unitNormal.z).toBeCloseTo(0, 12);
    expect(basisT2.x * unitNormal.x + basisT2.y * unitNormal.y + basisT2.z * unitNormal.z).toBeCloseTo(0, 12);
    expect(basisT1.x * basisT2.x + basisT1.y * basisT2.y + basisT1.z * basisT2.z).toBeCloseTo(0, 12);
  });

  it("x = y^2 + 3z pins the x-orientation gradient <1,-2y,-3>", () => {
    // Point (7,2,1): 7 = 4 + 3.
    const gradient = gradientOf(makeSurface("x = y^2 + 3*z", "x"), { x: 7, y: 2, z: 1 });
    expect(gradient.x).toBeCloseTo(1, 12);
    expect(gradient.y).toBeCloseTo(-4, 12);
    expect(gradient.z).toBeCloseTo(-3, 12);
  });

  it("y-orientation asymmetric case has no axis swap", () => {
    // y = x*z + 2*x at (1,5,3): 5 = 3 + 2. G = < -(z+2), 1, -x > = <-5,1,-1>.
    const gradient = gradientOf(makeSurface("y = x*z + 2*x", "y"), { x: 1, y: 5, z: 3 });
    expect(gradient.x).toBeCloseTo(-5, 12);
    expect(gradient.y).toBeCloseTo(1, 12);
    expect(gradient.z).toBeCloseTo(-1, 12);
  });

  it("lets point locals win over same-named parameters", () => {
    // params carry x=99, but the analysis point x=1 governs: fx = 2·1.
    const gradient = gradientOf(makeSurface("z = x^2"), { x: 1, y: 0, z: 1 }, { x: 99 });
    expect(gradient.x).toBeCloseTo(-2, 12);
  });

  it("threads parameters: z = a*x^2 + y^2, a = 3, at (2,1)", () => {
    const levelSet = normalizeSurfaceLevelSet(makeSurface("z = a*x^2 + y^2"));
    if ("error" in levelSet) {
      throw new Error("level set failed");
    }
    const compiled = compileScalarGradient(levelSet, { a: 3 });
    expect(compiled.error).toBeNull();
    const result = evaluateSurfaceGradient(compiled, { x: 2, y: 1, z: 13 }, { a: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gradient.x).toBeCloseTo(-12, 10);
    expect(result.gradient.y).toBeCloseTo(-2, 10);
    expect(result.gradient.z).toBeCloseTo(1, 10);
  });
});

describe("implicit surface analysis (S21 PART 12)", () => {
  it("sphere x^2+y^2+z^2=1 at (1,0,0): gradient <2,0,0>, unit <1,0,0>, plane x=1", () => {
    const gradient = gradientOf(makeImplicit("x^2+y^2+z^2=1"), { x: 1, y: 0, z: 0 });
    expect(gradient.x).toBeCloseTo(2, 12);
    expect(gradient.y).toBeCloseTo(0, 12);
    expect(gradient.z).toBeCloseTo(0, 12);

    const plane = tangentPlaneFromGradient({ x: 1, y: 0, z: 0 }, gradient);
    expect(plane.ok).toBe(true);
    if (!plane.ok) return;
    expect(plane.plane.unitNormal.x).toBeCloseTo(1, 12);
    expect(plane.plane.unitNormal.y).toBeCloseTo(0, 12);
    expect(plane.plane.unitNormal.z).toBeCloseTo(0, 12);
  });

  it("offset ellipsoid pins an off-axis gradient without axis errors", () => {
    // (x-1)^2/4 + (y+2)^2 + (z-0.5)^2/9 = 1 at (1,-2,3.5): gradient <0,0,2/3>.
    const gradient = gradientOf(makeImplicit("(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1"), {
      x: 1,
      y: -2,
      z: 3.5
    });
    expect(gradient.x).toBeCloseTo(0, 12);
    expect(gradient.y).toBeCloseTo(0, 12);
    expect(gradient.z).toBeCloseTo(2 / 3, 12);
  });

  it("zero gradient produces the critical-point outcome, never a plane", () => {
    // x^2+y^2+z^2=0 (single point at origin): gradient <0,0,0>.
    const gradient = gradientOf(makeImplicit("x^2+y^2+z^2=0"), { x: 0, y: 0, z: 0 });
    expect(Math.abs(gradient.x)).toBeLessThan(GRADIENT_ZERO_EPS);
    const plane = tangentPlaneFromGradient({ x: 0, y: 0, z: 0 }, gradient);
    expect(plane.ok).toBe(false);
    if (!plane.ok) {
      expect(plane.reason).toBe("zero-gradient");
    }
    expect(tangentBasisFromNormal(gradient)).toBeNull();
  });

  it("unsupported derivative keeps the source valid but analysis unavailable", () => {
    // tan is source-legal; its derivative (sec) is not.
    const levelSet = normalizeSurfaceLevelSet(makeSurface("z = tan(x)"));
    if ("error" in levelSet) {
      throw new Error("level set failed");
    }
    const compiled = compileScalarGradient(levelSet, {});
    expect(compiled.error).toMatch(/unavailable/i);
  });
});

describe("tangent basis stability (S21 PART 15/31)", () => {
  it("builds orthonormal bases near coordinate-axis normals", () => {
    for (const normal of [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 },
      { x: 4, y: 5, z: 6 }
    ]) {
      const basis = tangentBasisFromNormal(normal);
      expect(basis).not.toBeNull();
      if (!basis) continue;
      for (const vector of [basis.t1, basis.t2]) {
        expect(Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2)).toBeCloseTo(1, 12);
      }
      const dot = (a: typeof normal, b: typeof normal) => a.x * b.x + a.y * b.y + a.z * b.z;
      const nLen = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
      const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
      expect(dot(n, basis.t1)).toBeCloseTo(0, 12);
      expect(dot(n, basis.t2)).toBeCloseTo(0, 12);
      expect(dot(basis.t1, basis.t2)).toBeCloseTo(0, 12);
      for (const value of [basis.t1.x, basis.t1.y, basis.t1.z, basis.t2.x, basis.t2.y, basis.t2.z]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe("analysis world mapping (S21 PART 32)", () => {
  it("maps math point (1,2,3) and normal (4,5,6) to world (1,3,2)/(4,6,5)", () => {
    expect(mathToWorld3D({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: 2 });
    expect(mathVectorToWorld3D({ x: 4, y: 5, z: 6 })).toEqual({ x: 4, y: 6, z: 5 });
  });
});

describe("analysis point validity (S21 PART 28)", () => {
  it("accepts on-surface points within mesh tolerance", () => {
    // Sphere mesh at resolution 32 over ±1.5: spacing ≈ 0.094.
    const spacing = surfaceSampleSpacing(
      { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
      32,
      true
    );
    expect(spacing).toBeCloseTo(3 / 32, 12);
    // Exact surface point: distance 0.
    expect(isAnalysisPointOnSurface(0, { x: 2, y: 0, z: 0 }, spacing)).toBe(true);
    // Interpolated mesh point ~1e-3 off the surface: accepted.
    expect(isAnalysisPointOnSurface(0.002, { x: 2, y: 0, z: 0 }, spacing)).toBe(true);
    // Far point: rejected.
    expect(isAnalysisPointOnSurface(0.5, { x: 2, y: 0, z: 0 }, spacing)).toBe(false);
    // Zero gradient: never valid.
    expect(isAnalysisPointOnSurface(0, { x: 0, y: 0, z: 0 }, spacing)).toBe(false);
  });
});
