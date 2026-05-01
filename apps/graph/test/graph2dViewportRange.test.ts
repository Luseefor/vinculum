import { describe, expect, it } from "vitest";
import { computeViewport2dRange } from "@/components/graph/graph2d/graph2dViewportRange";

describe("computeViewport2dRange", () => {
  it("computes axis-aligned bounds from frame size and scale at origin", () => {
    const range = computeViewport2dRange({ width: 400, height: 300 }, { centerX: 0, centerY: 0, scale: 100 });
    expect(range.horizontalMin).toBeCloseTo(-2);
    expect(range.horizontalMax).toBeCloseTo(2);
    expect(range.verticalMin).toBeCloseTo(-1.5);
    expect(range.verticalMax).toBeCloseTo(1.5);
  });

  it("offsets by viewport center", () => {
    const range = computeViewport2dRange({ width: 200, height: 200 }, { centerX: 10, centerY: -5, scale: 50 });
    expect(range.horizontalMin).toBeCloseTo(8);
    expect(range.horizontalMax).toBeCloseTo(12);
    expect(range.verticalMin).toBeCloseTo(-7);
    expect(range.verticalMax).toBeCloseTo(-3);
  });
});
