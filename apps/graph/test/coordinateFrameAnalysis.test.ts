import { describe, it, expect } from "vitest";
import { buildParametricPolylineHV } from "@/components/graph/graph2d/graph2dCanvasParametricPolyline";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { tryAppendImplicitRenderableGraph } from "@/components/graph/graph2d/equationRenderableBranches";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";
import type { ParametricCurveObject, SurfaceGraphObject } from "@vinculum/scene/types";

// S1-U6: coordinate-system analysis (diagnostic-only, characterization).
// The unit circle x^2 + y^2 = 1 rendered as (a) a 2D implicit equation and
// (b) a 3D parametric curve (cos t, sin t, 0) projected into the xy 2D view
// must agree geometrically: the implicit path evaluates in math frame (x, y)
// and, since the S3-U5 F4 fix, the parametric path resolves world-frame
// sampler positions through the canonical math-axis mapping too.
// See the S1 engineering report (coordinate-frame inconsistency, now fixed
// for graph rendering; probe/measurement projection remains a follow-up).

const CIRCLE_IMPLICIT = "x^2 + y^2 = 1";

function makeCircleCurve(): ParametricCurveObject {
  return {
    id: "circle-curve",
    kind: "parametricCurve",
    color: "#3b82f6",
    visible: true,
    xExpr: "cos(t)",
    yExpr: "sin(t)",
    zExpr: "0",
    tMin: 0,
    tMax: 2 * Math.PI,
    samples: 240
  };
}

function makeImplicitCircleObject(): SurfaceGraphObject {
  return {
    id: "circle-implicit",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation: CIRCLE_IMPLICIT,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 40,
    appearance: { wireframe: false },
    orientation: "z"
  };
}

describe("coordinate frame analysis", () => {
  it("evaluates the implicit unit circle in math frame (x, y)", () => {
    const graphs: RenderableGraph[] = [];
    const appended = tryAppendImplicitRenderableGraph(
      graphs,
      makeImplicitCircleObject(),
      getAxisPairSpec("xy"),
      CIRCLE_IMPLICIT
    );
    expect(appended).toBe(true);
    const evaluate = graphs[0]?.implicitEvaluate;
    expect(evaluate).not.toBeNull();

    // Circle passes through (1, 0) and (0, 1); center evaluates to -1.
    expect(evaluate?.(1, 0)).toBeCloseTo(0, 9);
    expect(evaluate?.(0, 1)).toBeCloseTo(0, 9);
    expect(evaluate?.(0, 0)).toBeCloseTo(-1, 9);
  });

  it("projects the parametric unit circle as a circle (S3-U5 F4 fix)", () => {
    const polyline = buildParametricPolylineHV(makeCircleCurve(), "x", "y");
    expect(polyline).not.toBeNull();

    const horizontals: number[] = [];
    const verticals: number[] = [];
    for (let i = 0; i < (polyline?.length ?? 0); i += 2) {
      horizontals.push(polyline?.[i] ?? Number.NaN);
      verticals.push(polyline?.[i + 1] ?? Number.NaN);
    }

    // World-frame sampler positions resolved through the canonical math-axis
    // mapping: horizontal spans the diameter and vertical traces sin(t).
    expect(Math.min(...horizontals)).toBeCloseTo(-1, 3);
    expect(Math.max(...horizontals)).toBeCloseTo(1, 3);
    expect(Math.min(...verticals)).toBeCloseTo(-1, 3);
    expect(Math.max(...verticals)).toBeCloseTo(1, 3);
    for (let i = 0; i < horizontals.length; i += 1) {
      const h = horizontals[i] ?? 0;
      const v = verticals[i] ?? 0;
      expect(h * h + v * v).toBeCloseTo(1, 5);
    }
    // Both views of the same circle now agree: the implicit circle passes
    // through (0, 1) and the projected polyline reaches vertical 1.
    expect(Math.max(...verticals)).toBeGreaterThan(0.99);
  });
});
