import { expect, it } from "vitest";
import { createDefaultLineObject, createDefaultRayObject, createDefaultSegmentObject, createDefaultVectorObject } from "@vinculum/scene/defaults";
import { createPointGraph } from "@/lib/graph/createPointGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { fitGraph2dViewport } from "@/components/graph/graph2d/graph2dCanvasFit";

const xy = getAxisPairSpec("xy");
const frame = { width: 800, height: 600 }, current = { centerX: 0, centerY: 0, scale: 60 };

it("fits finite geometry outside the window and respects selection, visibility, and parameters", () => {
  const a = createPointGraph({ id: "a", xExpr: "offset", yExpr: "-20", zExpr: "0" });
  const b = createPointGraph({ id: "b", xExpr: "120", yExpr: "20", zExpr: "0" });
  const hidden = createPointGraph({ xExpr: "10000", yExpr: "10000", visible: false });
  const fit = fitGraph2dViewport([a, b, hidden], "xy", { offset: 100 }, current, frame)!;
  expect(fit.viewport).toEqual({ centerX: 110, centerY: 0, scale: 12 });
  expect(fit.sampled).toBe(false);
  expect(fitGraph2dViewport([a, b], "xy", { offset: 100 }, current, frame, "a")?.viewport).toEqual({ centerX: 100, centerY: -20, scale: 60 });
  expect(fitGraph2dViewport([a], "xz", { offset: 100 }, current, frame)).toBeNull();
  expect(fitGraph2dViewport([], "xy", {}, current, frame)).toBeNull();
});

it("fits parametric domains rather than just their currently visible portion", () => {
  const curve = createParametricCurve({ xExpr: "50+10*cos(t)", yExpr: "20+10*sin(t)", zExpr: "0", tMin: 0, tMax: 2*Math.PI, samples: 100 });
  const fit = fitGraph2dViewport([curve], "xy", {}, current, frame)!;
  expect(fit.viewport.centerX).toBeCloseTo(50, 1);
  expect(fit.viewport.centerY).toBeCloseTo(20, 1);
  expect(fit.viewport.scale).toBeGreaterThan(23);
  expect(fit.viewport.scale).toBeLessThan(25);
});

it("intersects spatial primitives without flattening their off-plane coordinates", () => {
  const segment = createDefaultSegmentObject({ id: "s", axExpr: "2", ayExpr: "4", azExpr: "-2", bxExpr: "6", byExpr: "8", bzExpr: "2" });
  expect(buildRenderableGraphsFromScene([segment], xy, {})[0].analysisPoints).toEqual([{ x: 4, y: 6 }]);
  expect(buildRenderableGraphsFromScene([{ ...segment, azExpr: "1", bzExpr: "2" }], xy, {})).toEqual([]);
  const line = createDefaultLineObject({ id: "l", pxExpr: "2", pyExpr: "3", pzExpr: "0", dxExpr: "1", dyExpr: "2", dzExpr: "0" });
  expect(buildRenderableGraphsFromScene([line], xy, {})[0].implicitEvaluate!(4, 7)).toBe(0);
  const ray = createDefaultRayObject({ id: "r", oxExpr: "0", oyExpr: "0", ozExpr: "0", dxExpr: "1", dyExpr: "0", dzExpr: "0" });
  const field = buildRenderableGraphsFromScene([ray], xy, {})[0].implicitEvaluate!;
  expect(field(-1, 0)).toBeNull();
  expect(field(1, 0)).toBe(0);
  const vector = createDefaultVectorObject({ id: "v", oxExpr: "1", oyExpr: "2", ozExpr: "0", vxExpr: "3", vyExpr: "4", vzExpr: "0" });
  expect(buildRenderableGraphsFromScene([vector], xy, {})[0].vectorField?.magnitudes[0]).toBe(5);
});

it.each(["xy", "xz", "yz"] as const)("slices a spatial surface in %s with coordinate-frame parity", pair => {
  const sphere = createParametricSurfaceGraph({ xExpr: "sin(u)*cos(v)", yExpr: "sin(u)*sin(v)", zExpr: "cos(u)", domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2*Math.PI }, resolution: 48 });
  const graphs = buildRenderableGraphsFromScene([sphere], getAxisPairSpec(pair), {});
  const points = graphs.find(graph => graph.polylineHV)?.polylineHV?.points!;
  expect(points.length).toBeGreaterThan(40);
  for (let i = 0; i < points.length; i += 2) expect(Math.hypot(points[i], points[i+1])).toBeCloseTo(1, 2);
});

it("retains coplanar area, exact sampled tangent contacts, and empty slices", () => {
  const plane = createParametricSurfaceGraph({ xExpr: "u", yExpr: "v", zExpr: "0", resolution: 16 });
  expect(buildRenderableGraphsFromScene([plane], xy, {})[0].meshXY?.indices.length).toBeGreaterThan(0);
  expect(buildRenderableGraphsFromScene([{ ...plane, zExpr: "1" }], xy, {})).toEqual([]);
  const tangent = { ...plane, zExpr: "u^2+v^2", domain: { uMin: -1, uMax: 1, vMin: -1, vMax: 1 } };
  expect(buildRenderableGraphsFromScene([tangent], xy, {}).flatMap(graph => graph.analysisPoints ?? [])).toContainEqual({ x: 0, y: 0 });
});
