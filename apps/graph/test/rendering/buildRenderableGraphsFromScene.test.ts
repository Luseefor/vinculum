import { describe, expect, it } from "vitest";
import { buildPlanarIntersectionGraphs, buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import type { ImplicitCurveObject } from "@vinculum/scene/types";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { createDefaultParametricCurve, createDefaultPlaneGraph } from "@vinculum/scene/defaults";

describe("buildRenderableGraphsFromScene", () => {
  it("draws only opted-in live curve intersection markers in the sampled view", () => {
    const a: ImplicitCurveObject = { id: "a", kind: "implicitCurve", equation: "x=30", visible: true, color: "#3080ef" };
    const b: ImplicitCurveObject = { ...a, id: "b", equation: "y=40" };
    const config = { a: { secondaryId: "b", showOverlay: true } };
    const domain = { xMin: 25, xMax: 35, yMin: 35, yMax: 45 };
    expect(buildPlanarIntersectionGraphs([a, b], config, {}, domain)[0].analysisPoints).toEqual([{ x: 30, y: 40, z: 0 }]);
    expect(buildPlanarIntersectionGraphs([a, b], { a: { secondaryId: "b", showOverlay: false } }, {}, domain)).toEqual([]);
    expect(buildPlanarIntersectionGraphs([a, { ...b, visible: false }], config, {}, domain)).toEqual([]);
    expect(buildPlanarIntersectionGraphs([a, { ...b, extendTo3D: true }], config, {}, domain)).toEqual([]);
    expect(buildPlanarIntersectionGraphs([a, { ...b, equation: "y=50" }], config, {}, domain)).toEqual([]);
  });
  const axisPair = getAxisPairSpec("xy");

  it("returns no graphs for an empty list", () => {
    expect(buildRenderableGraphsFromScene([], axisPair, {})).toEqual([]);
  });

  it("skips invisible objects", () => {
    const curve = createDefaultParametricCurve({ id: "c1", index: 0, xExpr: "t", yExpr: "t", zExpr: "0" });
    const hidden = { ...curve, visible: false };
    expect(buildRenderableGraphsFromScene([hidden], axisPair, {})).toEqual([]);
  });

  it("adds the bounded plane intersection for x = constant in XY", () => {
    const plane = createDefaultPlaneGraph({ id: "p1", index: 0, equation: "x = 3" });
    const graphs = buildRenderableGraphsFromScene([plane], axisPair, {});
    expect(graphs).toHaveLength(1);
    const points = graphs[0].polylineHV!.points;
    expect(points).toHaveLength(4);
    expect(points[0]).toBeCloseTo(3);
    expect(points[2]).toBeCloseTo(3);
    expect(Math.abs(points[1] - points[3])).toBeCloseTo(plane.size);
  });

  it("adds a parametric polyline when the curve projects into the axis pair", () => {
    const curve = createDefaultParametricCurve({
      id: "c1",
      index: 0,
      xExpr: "t",
      yExpr: "t",
      zExpr: "0",
      tMin: 0,
      tMax: 1,
      samples: 8
    });
    const graphs = buildRenderableGraphsFromScene([curve], axisPair, {});
    expect(graphs.length).toBeGreaterThanOrEqual(1);
    const g = graphs[0];
    expect(g.polylineHV).not.toBeNull();
    expect(g.polylineHV!.points.length).toBeGreaterThanOrEqual(4);
  });
});
