import { describe, expect, it } from "vitest";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { createDefaultParametricCurve, createDefaultPlaneGraph } from "@vinculum/scene/defaults";

describe("buildRenderableGraphsFromScene", () => {
  const axisPair = getAxisPairSpec("xy");

  it("returns no graphs for an empty list", () => {
    expect(buildRenderableGraphsFromScene([], axisPair)).toEqual([]);
  });

  it("skips invisible objects", () => {
    const curve = createDefaultParametricCurve({ id: "c1", index: 0, xExpr: "t", yExpr: "t", zExpr: "0" });
    const hidden = { ...curve, visible: false };
    expect(buildRenderableGraphsFromScene([hidden], axisPair)).toEqual([]);
  });

  it("adds a vertical line graph for x = constant in the XY plane", () => {
    const plane = createDefaultPlaneGraph({ id: "p1", index: 0, equation: "x = 3" });
    const graphs = buildRenderableGraphsFromScene([plane], axisPair);
    expect(graphs).toHaveLength(1);
    expect(graphs[0].verticalLineValue).toBeCloseTo(3);
    expect(graphs[0].polylineHV).toBeNull();
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
    const graphs = buildRenderableGraphsFromScene([curve], axisPair);
    expect(graphs.length).toBeGreaterThanOrEqual(1);
    const g = graphs[0];
    expect(g.polylineHV).not.toBeNull();
    expect(g.polylineHV!.length).toBeGreaterThanOrEqual(4);
  });
});
