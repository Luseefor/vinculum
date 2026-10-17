import { describe, expect, it } from "vitest";
import { snapGraph2dMathPoint } from "@/components/graph/graph2d/graph2dCanvasSnapMath";

describe("snapGraph2dMathPoint", () => {
  it("returns the point unchanged when snap is disabled", () => {
    const p = { horizontal: 1.23, vertical: 4.56 };
    expect(snapGraph2dMathPoint(p, false, 0.5)).toEqual(p);
  });

  it("snaps to the step when enabled", () => {
    const p = { horizontal: 1.23, vertical: 4.56 };
    const s = snapGraph2dMathPoint(p, true, 0.5);
    expect(s.horizontal).toBeCloseTo(1);
    expect(s.vertical).toBeCloseTo(4.5);
  });
});
