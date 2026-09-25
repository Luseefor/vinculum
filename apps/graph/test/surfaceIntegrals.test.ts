import { describe, expect, it } from "vitest";
import { compileExplicitSurfaceGeometry, compileParametricSurfaceGeometry } from "@/lib/math/surfaceGeometry";
import { fluxIntegral, scalarSurfaceIntegral, surfaceArea } from "@/lib/math/surfaceIntegrals";

const PLANE_DOMAIN = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
const SPHERE_DOMAIN = { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI };

function explicitPlane() {
  return compileExplicitSurfaceGeometry("z = 0", "z", {});
}

function unitSphere() {
  return compileParametricSurfaceGeometry("sin(u)*cos(v)", "sin(u)*sin(v)", "cos(u)", {});
}

describe("surface area (S25 PART 11)", () => {
  it("measures the z=0 plane over [-1,1]^2 as 4", () => {
    const result = surfaceArea(explicitPlane(), { uMin: -1, uMax: 1, vMin: -1, vMax: 1 }, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4, 10);
  });

  it("measures z=x+2y over [0,1]^2 as sqrt(6)", () => {
    const geometry = compileExplicitSurfaceGeometry("z = x + 2*y", "z", {});
    const result = surfaceArea(geometry, { uMin: 0, uMax: 1, vMin: 0, vMax: 1 }, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(Math.sqrt(6), 10);
  });

  it("measures the parametric plane P=<u,v,0> as 4", () => {
    const geometry = compileParametricSurfaceGeometry("u", "v", "0", {});
    const result = surfaceArea(geometry, PLANE_DOMAIN, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4, 10);
  });

  it("measures the unit sphere as 4*pi", () => {
    const result = surfaceArea(unitSphere(), SPHERE_DOMAIN, "high");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4 * Math.PI, 5);
    expect(result.estimatedError).toBeLessThan(1e-4);
  });

  it("measures the torus R=2 r=0.5 as 4*pi^2", () => {
    const geometry = compileParametricSurfaceGeometry(
      "(2 + 0.5*cos(v))*cos(u)",
      "(2 + 0.5*cos(v))*sin(u)",
      "0.5*sin(v)",
      {}
    );
    expect(geometry.error).toBeNull();
    const result = surfaceArea(geometry, { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI }, "high");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4 * Math.PI * Math.PI, 3);
  });
});

describe("scalar surface integrals (S25 PART 12)", () => {
  it("integrates g=1 over the plane as 4", () => {
    const result = scalarSurfaceIntegral(explicitPlane(), PLANE_DOMAIN, "1", {}, "medium");
    expect(result.status).toBe("ok");
    expect(result.value).toBeCloseTo(4, 10);
  });

  it("vanishes for g=x+y over the symmetric plane", () => {
    const result = scalarSurfaceIntegral(explicitPlane(), PLANE_DOMAIN, "x+y", {}, "medium");
    expect(result.status).toBe("ok");
    expect(Math.abs(result.value)).toBeLessThan(1e-9);
  });

  it("matches area for g=1 on the sphere", () => {
    const area = surfaceArea(unitSphere(), SPHERE_DOMAIN, "medium");
    const scalar = scalarSurfaceIntegral(unitSphere(), SPHERE_DOMAIN, "1", {}, "medium");
    expect(scalar.status).toBe("ok");
    expect(scalar.value).toBeCloseTo(area.value, 8);
    expect(scalar.value).toBeCloseTo(4 * Math.PI, 5);
  });

  it("reports invalid for g=1/x across x=0", () => {
    const result = scalarSurfaceIntegral(explicitPlane(), PLANE_DOMAIN, "1/x", {}, "medium");
    expect(result.status).toBe("invalid");
  });
});

describe("flux (S25 PART 13/37)", () => {
  it("pins +z plane F=<0,0,1> as +4, reversed as -4", () => {
    const domain = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
    const field = { pExpr: "0", qExpr: "0", rExpr: "1" };
    const forward = fluxIntegral(explicitPlane(), domain, field, {}, "medium", 1);
    expect(forward.status).toBe("ok");
    expect(forward.value).toBeCloseTo(4, 10);
    const reverse = fluxIntegral(explicitPlane(), domain, field, {}, "medium", -1);
    expect(reverse.status).toBe("ok");
    expect(reverse.value).toBeCloseTo(-4, 10);
  });

  it("pins +x plane F=<1,0,0> as +4, reversed as -4", () => {
    const geometry = compileExplicitSurfaceGeometry("x = 0", "x", {});
    const domain = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
    const field = { pExpr: "1", qExpr: "0", rExpr: "0" };
    expect(fluxIntegral(geometry, domain, field, {}, "medium", 1).value).toBeCloseTo(4, 10);
    expect(fluxIntegral(geometry, domain, field, {}, "medium", -1).value).toBeCloseTo(-4, 10);
  });

  it("pins +y plane F=<0,1,0> as +4, reversed as -4", () => {
    const geometry = compileExplicitSurfaceGeometry("y = 0", "y", {});
    const domain = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
    const field = { pExpr: "0", qExpr: "1", rExpr: "0" };
    expect(fluxIntegral(geometry, domain, field, {}, "medium", 1).value).toBeCloseTo(4, 10);
    expect(fluxIntegral(geometry, domain, field, {}, "medium", -1).value).toBeCloseTo(-4, 10);
  });

  it("pins parametric plane Pu×Pv=<0,0,1> flux as +4/-4", () => {
    const geometry = compileParametricSurfaceGeometry("u", "v", "0", {});
    const field = { pExpr: "0", qExpr: "0", rExpr: "1" };
    expect(fluxIntegral(geometry, PLANE_DOMAIN, field, {}, "medium", 1).value).toBeCloseTo(4, 10);
    expect(fluxIntegral(geometry, PLANE_DOMAIN, field, {}, "medium", -1).value).toBeCloseTo(-4, 10);
  });

  it("measures radial sphere flux as +4*pi natively (outward)", () => {
    const field = { pExpr: "x", qExpr: "y", rExpr: "z" };
    const forward = fluxIntegral(unitSphere(), SPHERE_DOMAIN, field, {}, "high", 1);
    expect(forward.status).toBe("ok");
    expect(forward.value).toBeCloseTo(4 * Math.PI, 4);
    const reverse = fluxIntegral(unitSphere(), SPHERE_DOMAIN, field, {}, "high", -1);
    expect(reverse.value).toBeCloseTo(-4 * Math.PI, 4);
  });

  it("vanishes for constant-field closed sphere flux", () => {
    const result = fluxIntegral(unitSphere(), SPHERE_DOMAIN, { pExpr: "1", qExpr: "0", rExpr: "0" }, {}, "high", 1);
    expect(result.status).toBe("ok");
    expect(Math.abs(result.value)).toBeLessThan(1e-4);
  });
});
