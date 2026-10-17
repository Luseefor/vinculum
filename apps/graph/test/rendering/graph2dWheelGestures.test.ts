import { describe, expect, it } from "vitest";
import { graph2dWheelViewportPatch } from "@/components/graph/graph2d/graph2dCanvasInteractionZoom";

const VIEWPORT = { centerX: 0, centerY: 0, scale: 60 };

describe("infinite-paper wheel gestures (S26 2D canvas)", () => {
  it("pans full trackpad deltas at 100% scale without changing zoom", () => {
    const patch = graph2dWheelViewportPatch(
      { deltaX: 40, deltaY: -25, deltaMode: 0, ctrlKey: false, metaKey: false, clientX: 400, clientY: 300 },
      800,
      600,
      VIEWPORT
    );
    expect(patch).not.toBeNull();
    expect(patch?.scale).toBe(60);
    expect(patch?.centerX).toBeCloseTo(40 / 60, 12);
    expect(patch?.centerY).toBeCloseTo(25 / 60, 12);
  });

  it("pans horizontally and vertically in one gesture", () => {
    const patch = graph2dWheelViewportPatch(
      { deltaX: -120, deltaY: 80, deltaMode: 0, ctrlKey: false, metaKey: false, clientX: 100, clientY: 100 },
      800,
      600,
      VIEWPORT
    );
    expect(patch?.centerX).toBeCloseTo(-2, 12);
    expect(patch?.centerY).toBeCloseTo(-80 / 60, 12);
  });

  it("zooms toward the cursor on Ctrl+wheel with delta-proportional factor", () => {
    const before = { ...VIEWPORT };
    const patch = graph2dWheelViewportPatch(
      { deltaX: 0, deltaY: -10, deltaMode: 0, ctrlKey: true, metaKey: false, clientX: 400, clientY: 300 },
      800,
      600,
      before
    );
    expect(patch).not.toBeNull();
    expect(patch!.scale).toBeGreaterThan(before.scale);
    expect(patch!.scale).toBeLessThanOrEqual(before.scale * 2);
    // Zooming at canvas center keeps the center fixed.
    expect(patch!.centerX).toBeCloseTo(0, 12);
    expect(patch!.centerY).toBeCloseTo(0, 12);
    const out = graph2dWheelViewportPatch(
      { deltaX: 0, deltaY: 50, deltaMode: 0, ctrlKey: true, metaKey: false, clientX: 400, clientY: 300 },
      800,
      600,
      before
    );
    expect(out!.scale).toBeLessThan(before.scale);
  });

  it("normalizes line/page deltaModes and rejects non-finite input", () => {
    const lines = graph2dWheelViewportPatch(
      { deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false, metaKey: false, clientX: 0, clientY: 0 },
      800,
      600,
      VIEWPORT
    );
    expect(lines?.centerY).toBeCloseTo(-(3 * 16) / 60, 12);
    expect(
      graph2dWheelViewportPatch(
        { deltaX: Number.NaN, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, clientX: 0, clientY: 0 },
        800,
        600,
        VIEWPORT
      )
    ).toBeNull();
    expect(
      graph2dWheelViewportPatch(
        { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, clientX: 0, clientY: 0 },
        0,
        600,
        VIEWPORT
      )
    ).toBeNull();
  });
});
