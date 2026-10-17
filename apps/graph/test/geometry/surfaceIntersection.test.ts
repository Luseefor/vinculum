import { describe, expect, it } from "vitest";
import type { SurfaceGraphObject, ParametricSurfaceObject, ImplicitSurfaceObject, PlaneGraphObject } from "@vinculum/scene/types";
import { computeSurfaceIntersection } from "@/lib/math/geometry/surfaceIntersection";
import { computeGeometryFacts, geometryPairSupported, resolveGeometrySource } from "@/lib/math/geometry/geometryAnalysis";

const base={ color: "#3080ef", visible: true, appearance: { wireframe: false } };
const surface=(equation: string, orientation: "x"|"y"|"z"="z"): SurfaceGraphObject => ({ ...base, id: equation, kind: "surface", equation, orientation, domain: { xMin:-2,xMax:2,yMin:-2,yMax:2 }, resolution:24 });
const parametric=(zExpr="v"): ParametricSurfaceObject => ({ ...base,id:"param",kind:"parametricSurface",xExpr:"u",yExpr:"0",zExpr,domain:{uMin:-2,uMax:2,vMin:-2,vMax:2},resolution:24 });
const plane=(equation: string): PlaneGraphObject => ({ ...base,id:"plane",kind:"plane",equation,size:8 });
const sphere=(): ImplicitSurfaceObject => ({ ...base,id:"sphere",kind:"implicitSurface",equation:"x^2+y^2+z^2=1",domain:{xMin:-1.5,xMax:1.5,yMin:-1.5,yMax:1.5,zMin:-1.5,zMax:1.5},resolution:16 });

describe("surface intersection numerical solutions", () => {
  it("retains coplanar shared edges and isolated corner contacts", () => {
    const patch = (xMin: number, xMax: number, yMin: number, yMax: number) => ({ ...surface("0"), domain: { xMin, xMax, yMin, yMax } });
    const a = patch(-1, 0, -1, 0);
    const edge = computeSurfaceIntersection(a, patch(0, 1, -1, 0), {});
    expect(edge.status).toBe("curve");
    for (const p of edge.segments.flat()) { expect(p.x).toBeCloseTo(0, 5); expect(p.z).toBeCloseTo(0, 5); }
    const corner = computeSurfaceIntersection(a, patch(0, 1, 0, 1), {});
    expect(corner.status).toBe("points");
    expect(corner.points).toEqual([{ x: 0, y: 0, z: 0 }]);
    expect(computeSurfaceIntersection(a, patch(.1, 1, .1, 1), {}).status).toBe("empty");
  });
  it("finds a paraboloid section and returns mathematical coordinates", () => {
    const result=computeSurfaceIntersection(surface("x^2+y^2"),plane("z=1"),{});
    expect(result.status).toBe("curve");
    expect(result.segments.length).toBeGreaterThan(20);
    for (const p of result.segments.flat()) {
      expect(p.z).toBeCloseTo(1,5);
      expect(p.x*p.x+p.y*p.y).toBeCloseTo(1,1);
    }
    expect(result.equations).toEqual(["z = x^2+y^2","z=1"]);
    expect(result.reducedEquation).toContain("x ^ 2");
    expect(result.reducedEquation).toContain("y ^ 2");
  });
  it("supports explicit orientations, parametric/explicit and parametric/parametric pairs", () => {
    const explicit=computeSurfaceIntersection(surface("0","x"),surface("0"),{});
    expect(explicit.status).toBe("curve");
    for (const p of explicit.segments.flat()) { expect(p.x).toBeCloseTo(0,5); expect(p.z).toBeCloseTo(0,5); }
    expect(computeSurfaceIntersection(parametric(),surface("0"),{}).status).toBe("curve");
    const other={...parametric(),id:"other",xExpr:"0",yExpr:"u",zExpr:"v"};
    const result=computeSurfaceIntersection(parametric(),other,{});
    expect(result.status).toBe("curve");
    expect(result.equations[0]).toContain("u_1"); expect(result.equations[1]).toContain("u_2");
  });
  it("supports implicit/plane and implicit/implicit intersections", () => {
    const result=computeSurfaceIntersection(sphere(),plane("z=0"),{});
    expect(result.status).toBe("curve");
    for (const p of result.segments.flat()) { expect(p.z).toBeCloseTo(0,5); expect(p.x*p.x+p.y*p.y).toBeCloseTo(1,1); }
    const second={...sphere(),id:"second",equation:"(x-0.5)^2+y^2+z^2=1"};
    expect(computeSurfaceIntersection(sphere(),second,{}).status).toBe("curve");
  });
  it("distinguishes empty, coincident, tangent and invalid definitions", () => {
    expect(computeSurfaceIntersection(surface("0"),plane("z=3"),{}).status).toBe("empty");
    const coincident=computeSurfaceIntersection(surface("0"),surface("0"),{});
    expect(coincident.status).toBe("overlap"); expect(coincident.segments).toEqual([]);
    expect(computeSurfaceIntersection(surface("x^2+y^2"),plane("z=0"),{}).status).toBe("points");
    const invalid=computeSurfaceIntersection(surface("unknown(x)"),plane("z=0"),{});
    expect(invalid.status).toBe("unresolved"); expect(invalid.segments).toEqual([]);
  });
  it("uses finite ranges, avoids invalid samples and invalidates parameter changes", () => {
    const a=surface("a"), b=plane("z=0");
    const first=computeSurfaceIntersection(a,b,{a:0});
    expect(first.status).toBe("overlap");
    expect(computeSurfaceIntersection(a,b,{a:1}).status).toBe("empty");
    expect(computeSurfaceIntersection({...a,color:"#ff0000"},b,{a:0})).toBe(first);
    expect(computeSurfaceIntersection(surface("sqrt(-1)"),b,{}).status).toBe("empty");
    const outOfRange={...surface("x"),domain:{xMin:1,xMax:2,yMin:1,yMax:2}};
    expect(computeSurfaceIntersection(outOfRange,b,{}).status).toBe("empty");
  });
  it("extends the canonical geometry facts without accepting unrelated kinds", () => {
    expect(geometryPairSupported("parametricSurface","implicitSurface")).toBe(true);
    expect(geometryPairSupported("surface","plane")).toBe(true);
    expect(geometryPairSupported("surface","vectorField")).toBe(false);
    const a=surface("x"),b=plane("z=0");
    const facts=computeGeometryFacts(resolveGeometrySource(a,{}),resolveGeometrySource(b,{}));
    expect(facts.pair).toBe("surface-surface");
  });
});
