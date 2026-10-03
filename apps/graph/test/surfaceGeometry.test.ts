import { describe, expect, it } from "vitest";
import {
  compileExplicitSurfaceGeometry,
  compileParametricSurfaceGeometry
} from "@/lib/math/surfaceGeometry";

describe("explicit surface differential vectors (S25 PART 33)", () => {
  it("pins z=x^2+2y^2 at (1,2): factor sqrt(69), vector <-2,-8,1>", () => {
    const geometry = compileExplicitSurfaceGeometry("z = x^2 + 2*y^2", "z", {});
    expect(geometry.error).toBeNull();
    expect(geometry.vars).toEqual(["x", "y"]);
    expect(geometry.evaluate(1, 2)).toEqual([1, 2, 9]);
    expect(geometry.areaFactor(1, 2)).toBeCloseTo(Math.sqrt(69), 10);
    expect(geometry.areaVector(1, 2)).toEqual([-2, -8, 1]);
  });

  it("pins x=y^2+3z directed area <1,-2y,-3>", () => {
    const geometry = compileExplicitSurfaceGeometry("x = y^2 + 3*z", "x", {});
    expect(geometry.error).toBeNull();
    expect(geometry.vars).toEqual(["y", "z"]);
    expect(geometry.evaluate(2, 1)).toEqual([7, 2, 1]);
    expect(geometry.areaVector(2, 1)).toEqual([1, -4, -3]);
    expect(geometry.areaFactor(2, 1)).toBeCloseTo(Math.sqrt(1 + 16 + 9), 10);
  });

  it("pins y=x^2+3z directed area <-2x,1,-3> (positive y, never -y)", () => {
    const geometry = compileExplicitSurfaceGeometry("y = x^2 + 3*z", "y", {});
    expect(geometry.error).toBeNull();
    expect(geometry.vars).toEqual(["x", "z"]);
    expect(geometry.areaVector(2, 1)).toEqual([-4, 1, -3]);
  });
});

describe("parametric surface differential vectors (S25 PART 34)", () => {
  it("pins the asymmetric case Pu=<1,0,3>, Pv=<0,2,1>", () => {
    const geometry = compileParametricSurfaceGeometry("u", "2*v", "3*u+v", {});
    expect(geometry.error).toBeNull();
    expect(geometry.evaluate(1, 2)).toEqual([1, 4, 5]);
    // Pu × Pv = |i j k; 1 0 3; 0 2 1| = <0*1-3*2, 3*0-1*1, 1*2-0*0> = <-6,-1,2>.
    expect(geometry.areaVector(1, 2)).toEqual([-6, -1, 2]);
    expect(geometry.areaFactor(1, 2)).toBeCloseTo(Math.sqrt(36 + 1 + 4), 12);
  });

  it("gives the plane Pu×Pv=<0,0,1>", () => {
    const geometry = compileParametricSurfaceGeometry("u", "v", "0", {});
    expect(geometry.error).toBeNull();
    expect(geometry.areaVector(0.3, -0.7)).toEqual([0, 0, 1]);
    expect(geometry.areaFactor(0.3, -0.7)).toBeCloseTo(1, 12);
  });

  it("reports zero area factor (not NaN) at degenerate points", () => {
    // Sphere poles: Pu × Pv = 0 is a valid zero contribution.
    const geometry = compileParametricSurfaceGeometry(
      "sin(u)*cos(v)",
      "sin(u)*sin(v)",
      "cos(u)",
      {}
    );
    expect(geometry.error).toBeNull();
    expect(geometry.areaFactor(0, 1)).toBeCloseTo(0, 12);
    expect(geometry.areaVector(0, 1)).toEqual([0, 0, 0]);
  });
});
