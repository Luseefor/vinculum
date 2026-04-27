import { describe, expect, it } from "vitest";
import { graph2dViewportPatchZoomAtScreen } from "@/components/graph/graph2d/graph2dCanvasInteractionZoom";

describe("graph2dViewportPatchZoomAtScreen", () => {
  it("increases scale when zooming in (factor > 1)", () => {
    const viewport = { centerX: 0, centerY: 0, scale: 50 };
    const patch = graph2dViewportPatchZoomAtScreen(100, 100, 1.25, 200, 200, viewport);
    expect(patch.scale).toBeGreaterThan(viewport.scale);
    expect(Number.isFinite(patch.centerX)).toBe(true);
    expect(Number.isFinite(patch.centerY)).toBe(true);
  });

  it("decreases scale when zooming out (factor < 1)", () => {
    const viewport = { centerX: 1, centerY: -2, scale: 80 };
    const patch = graph2dViewportPatchZoomAtScreen(50, 50, 0.8, 200, 200, viewport);
    expect(patch.scale).toBeLessThan(viewport.scale);
  });
});
