import { describe, it, expect } from "vitest";
import { buildParametricPolylineHV } from "@/components/graph/graph2d/graph2dCanvasParametricPolyline";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { tryAppendImplicitRenderableGraph } from "@/components/graph/graph2d/equationRenderableBranches";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";
import type { ParametricCurveObject, SurfaceGraphObject } from "@vinculum/scene/types";

// S1-U6: coordinate-system analysis (diagnostic-only, characterization).
// The unit circle x^2 + y^2 = 1 rendered as (a) a 2D implicit equation and
// (b) a 3D parametric curve (cos t, sin t, 0) projected into the xy 2D view
// disagree geometrically under current behavior: the implicit path evaluates
// in math frame (x, y) while the parametric path reads world-frame sampler
// positions (x, z-as-up, y) with math-frame component indices.
// See the S1 engineering report (coordinate-frame inconsistency).

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

  it("projects the parametric unit circle flat (vertical reads world-up = math z = 0)", () => {
    const polyline = buildParametricPolylineHV(makeCircleCurve(), "x", "y");
    expect(polyline).not.toBeNull();

    const horizontals: number[] = [];
    const verticals: number[] = [];
    for (let i = 0; i < (polyline?.length ?? 0); i += 2) {
      horizontals.push(polyline?.[i] ?? Number.NaN);
      verticals.push(polyline?.[i + 1] ?? Number.NaN);
    }

    // Horizontal spans the circle diameter; vertical is uniformly zero because
    // component index 1 reads world-Y (math z), which is 0 for this curve.
    expect(Math.min(...horizontals)).toBeCloseTo(-1, 3);
    expect(Math.max(...horizontals)).toBeCloseTo(1, 3);
    for (const vertical of verticals) {
      expect(vertical).toBeCloseTo(0, 9);
    }
    // The implicit circle passes through (0, 1); the projected polyline never
    // reaches vertical 1 -> the two views of the same circle disagree.
    expect(Math.max(...verticals)).toBeLessThan(0.5);
  });
});
