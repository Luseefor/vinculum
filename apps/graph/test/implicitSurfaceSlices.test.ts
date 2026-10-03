import { describe, expect, it } from "vitest";
import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { drawImplicitContour } from "@/components/graph/graph2d/graph2dCanvasImplicitDraw";

const torus = createImplicitSurfaceGraph({ equation: "(x^2+y^2+z^2+3.75)^2-16*(x^2+y^2)=0" });
describe("implicit surface coordinate-plane cross-sections", () => {
  it("draws both torus circles in XY without filling or projecting the surface", () => {
    const graph = buildRenderableGraphsFromScene([torus], getAxisPairSpec("xy"), {})[0];
    const field = graph.implicitEvaluate!;
    expect(field(1.5, 0)).toBeCloseTo(0);
    expect(field(0, 2.5)).toBeCloseTo(0);
    expect(field(2, 0)).toBeLessThan(0);
    expect(field(0, 0)).toBeGreaterThan(0);
    const radii: number[] = [];
    const capture = (x: number, y: number) => radii.push(Math.hypot((x-200)/50, (y-200)/50));
    drawImplicitContour(field, { moveTo: capture, lineTo: capture }, { width: 400, height: 400, centerX: 0, centerY: 0, scale: 50 }, 400, 400);
    expect(radii.filter(r => Math.abs(r-1.5)<0.01).length).toBeGreaterThan(100);
    expect(radii.filter(r => Math.abs(r-2.5)<0.01).length).toBeGreaterThan(100);
    expect(radii.every(r => Math.abs(r-1.5)<0.01 || Math.abs(r-2.5)<0.01)).toBe(true);
    expect(graph.hatchDomain).toBeNull();
  });
  it.each(["xy", "xz", "yz"] as const)("maps scalar and batched %s samples to the correct axes", pair => {
    const compiled = compileImplicitSurfaceExpression("x^2+2*y^2+3*z^2=a", { a: 4 });
    const spec = getAxisPairSpec(pair);
    const graph = buildRenderableGraphsFromScene([createImplicitSurfaceGraph({ equation: "x^2+2*y^2+3*z^2=a" })], spec, { a: 4 })[0];
    const batch = compiled.samplePlaneGrid!(spec.horizontal, spec.vertical, -2, 3, 67, -1, 2, 35);
    for (const row of [0, 31, 32, 34]) for (const column of [0, 31, 32, 66]) {
      const h = -2+5*column/66, v = -1+3*row/34;
      const coords = { x: 0, y: 0, z: 0, [spec.horizontal]: h, [spec.vertical]: v };
      const expected = coords.x**2+2*coords.y**2+3*coords.z**2-4;
      expect(graph.implicitEvaluate!(h, v)).toBeCloseTo(expected, 10);
      expect(batch[row*67+column]).toBeCloseTo(expected, 10);
    }
  });
  it("refreshes parameters, keeps per-plane caches stable, and omits hidden or invalid surfaces", () => {
    const object = createImplicitSurfaceGraph({ equation: "x^2+y^2+z^2=a" });
    const xy = getAxisPairSpec("xy");
    const first = buildRenderableGraphsFromScene([object], xy, { a: 1 })[0].implicitEvaluate!;
    expect(buildRenderableGraphsFromScene([object], xy, { a: 1 })[0].implicitEvaluate).toBe(first);
    expect(buildRenderableGraphsFromScene([object], xy, { a: 4 })[0].implicitEvaluate!(1, 0)).toBe(-3);
    expect(buildRenderableGraphsFromScene([{ ...object, visible: false }], xy, { a: 1 })).toEqual([]);
    expect(buildRenderableGraphsFromScene([{ ...object, equation: "x=" }], xy, {})).toEqual([]);
    const pole = createImplicitSurfaceGraph({ equation: "1/z=x+y" });
    expect(buildRenderableGraphsFromScene([pole], xy, {})[0].implicitEvaluate!(1, 1)).toBeNull();
  });
});
