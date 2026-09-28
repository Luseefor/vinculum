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

describe("graph2dPinchViewportPatch (S34-B1)", () => {
  it("spreading fingers zooms in (scale grows), pinching zooms out", async () => {
    const { graph2dPinchViewportPatch } = await import(
      "@/components/graph/graph2d/graph2dCanvasInteractionZoom"
    );
    const viewport = { centerX: 0, centerY: 0, scale: 50 };
    const spread = graph2dPinchViewportPatch(
      { distance: 180, midX: 100, midY: 100 },
      { distance: 260, midX: 100, midY: 100 },
      200,
      200,
      viewport
    );
    expect(spread).not.toBeNull();
    expect(spread!.scale).toBeGreaterThan(viewport.scale);
    const squeeze = graph2dPinchViewportPatch(
      { distance: 260, midX: 100, midY: 100 },
      { distance: 180, midX: 100, midY: 100 },
      200,
      200,
      viewport
    );
    expect(squeeze!.scale).toBeLessThan(viewport.scale);
  });

  it("pans with the midpoint while zooming", async () => {
    const { graph2dPinchViewportPatch } = await import(
      "@/components/graph/graph2d/graph2dCanvasInteractionZoom"
    );
    const viewport = { centerX: 0, centerY: 0, scale: 50 };
    const moved = graph2dPinchViewportPatch(
      { distance: 180, midX: 100, midY: 100 },
      { distance: 180, midX: 140, midY: 100 },
      200,
      200,
      viewport
    );
    expect(moved!.scale).toBeCloseTo(viewport.scale, 9);
    expect(moved!.centerX).toBeLessThan(viewport.centerX);
  });

  it("rejects degenerate input without touching the viewport", async () => {
    const { graph2dPinchViewportPatch } = await import(
      "@/components/graph/graph2d/graph2dCanvasInteractionZoom"
    );
    const viewport = { centerX: 0, centerY: 0, scale: 50 };
    expect(
      graph2dPinchViewportPatch(
        { distance: 0, midX: 100, midY: 100 },
        { distance: 100, midX: 100, midY: 100 },
        200,
        200,
        viewport
      )
    ).toBeNull();
    expect(
      graph2dPinchViewportPatch(
        { distance: 100, midX: 100, midY: 100 },
        { distance: 100, midX: 100, midY: 100 },
        0,
        200,
        viewport
      )
    ).toBeNull();
  });
});
