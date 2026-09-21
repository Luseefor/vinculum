import { describe, it, expect } from "vitest";
import { buildParametricPolylineHV } from "@/components/graph/graph2d/graph2dCanvasParametricPolyline";
import { projectMathToPair2D, type MathAxisPair } from "@/lib/math/coordinates";
import type { ParametricCurveObject } from "@vinculum/scene/types";

// S3-U4: F4 regression tests (pre-fix: these FAIL).
// Canonical contract: XY -> (x, y), XZ -> (x, z), YZ -> (y, z) in MATH frame.
// buildParametricPolylineHV reads WORLD-frame sampleCurve positions
// (math(x,y,z) -> world(x,z,y)) with math-frame component indices, so every
// pair involving y or z is projected from the wrong components.
// Deliberately asymmetric curve x=t, y=2t, z=3t so swaps cannot hide.

function makeLineCurve(): ParametricCurveObject {
  return {
    id: "line-curve",
    kind: "parametricCurve",
    color: "#3b82f6",
    visible: true,
    xExpr: "t",
    yExpr: "2*t",
    zExpr: "3*t",
    tMin: 0,
    tMax: 1,
    samples: 5
  };
}

const T_VALUES = [0, 0.25, 0.5, 0.75, 1];

const EXPECTED: Record<MathAxisPair, Array<[number, number]>> = {
  xy: T_VALUES.map((t) => [t, 2 * t]),
  xz: T_VALUES.map((t) => [t, 3 * t]),
  yz: T_VALUES.map((t) => [2 * t, 3 * t])
};

function pairAxes(pair: MathAxisPair): { horizontal: "x" | "y" | "z"; vertical: "x" | "y" | "z" } {
  if (pair === "xz") {
    return { horizontal: "x", vertical: "z" };
  }
  if (pair === "yz") {
    return { horizontal: "y", vertical: "z" };
  }
  return { horizontal: "x", vertical: "y" };
}

describe("parametric 2D frame regression", () => {
  (Object.keys(EXPECTED) as MathAxisPair[]).forEach((pair) => {
    it(`projects x=t, y=2t, z=3t correctly in ${pair.toUpperCase()} view`, () => {
      const axes = pairAxes(pair);
      const polyline = buildParametricPolylineHV(makeLineCurve(), axes.horizontal, axes.vertical);
      expect(polyline).not.toBeNull();

      const expected = EXPECTED[pair] ?? [];
      expect(polyline?.length).toBe(expected.length * 2);
      expected.forEach(([expectedH, expectedV], index) => {
        expect(polyline?.[index * 2]).toBeCloseTo(expectedH, 9);
        expect(polyline?.[index * 2 + 1]).toBeCloseTo(expectedV, 9);
      });
    });
  });

  it("agrees with the canonical projectMathToPair2D contract", () => {
    (Object.keys(EXPECTED) as MathAxisPair[]).forEach((pair) => {
      const expected = EXPECTED[pair] ?? [];
      expected.forEach(([expectedH, expectedV], index) => {
        const t = T_VALUES[index] ?? 0;
        expect(projectMathToPair2D({ x: t, y: 2 * t, z: 3 * t }, pair)).toEqual({
          horizontal: expectedH,
          vertical: expectedV
        });
      });
    });
  });
});
