import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DEFAULT_ORTHO_SPAN, GeometryOrthoController } from "@/lib/graph3d/graphThreeOrthoViews";
import type { PaneRect } from "@/lib/graph3d/graphThreeGeometryViews";

const RECT: PaneRect = { left: 0, top: 0, width: 800, height: 600 };

function projectToNdc(
  controller: GeometryOrthoController,
  view: "xy" | "xz" | "yz",
  point: Vector3
) {
  controller.updateFrustum(view, RECT);
  const camera = controller.getCamera(view);
  return point.clone().project(camera);
}

describe("GeometryOrthoController frustum", () => {
  it("preserves aspect without stretching", () => {
    const controller = new GeometryOrthoController();
    for (const view of ["xy", "xz", "yz"] as const) {
      controller.updateFrustum(view, { left: 0, top: 0, width: 1600, height: 900 });
      const camera = controller.getCamera(view);
      const frustumAspect = (camera.right - camera.left) / (camera.top - camera.bottom);
      expect(frustumAspect).toBeCloseTo(1600 / 900, 9);
    }
  });

  it("frames the default span on the minimum dimension", () => {
    const controller = new GeometryOrthoController();
    controller.updateFrustum("xy", RECT);
    const camera = controller.getCamera("xy");
    expect(camera.top - camera.bottom).toBeCloseTo(DEFAULT_ORTHO_SPAN, 9);
  });
});

describe("GeometryOrthoController pan", () => {
  it.each(["xy", "xz", "yz"] as const)("grab-pans content with the pointer in %s", (view) => {
    const controller = new GeometryOrthoController();
    const before = projectToNdc(controller, view, new Vector3(0, 0, 0));
    controller.panByPixels(view, 100, 60, RECT);
    const after = projectToNdc(controller, view, new Vector3(0, 0, 0));
    // Content follows the cursor: dragging right/down moves the fixed
    // world point right/down on screen.
    expect(after.x - before.x).toBeGreaterThan(0);
    expect(after.y - before.y).toBeLessThan(0);
  });
});

describe("GeometryOrthoController portrait frustum and exact pan", () => {
  it("frames the span on the width for tall panes without stretching", () => {
    const controller = new GeometryOrthoController();
    controller.updateFrustum("xy", { left: 0, top: 0, width: 600, height: 900 });
    const camera = controller.getCamera("xy");
    // Min dimension is the width: span 12 across, height scaled by 900/600.
    expect(camera.right - camera.left).toBeCloseTo(DEFAULT_ORTHO_SPAN, 9);
    expect(camera.left).toBeCloseTo(-DEFAULT_ORTHO_SPAN / 2, 9);
    expect(camera.right).toBeCloseTo(DEFAULT_ORTHO_SPAN / 2, 9);
    expect(camera.top).toBeCloseTo((DEFAULT_ORTHO_SPAN / 2) * (900 / 600), 9);
    expect(camera.bottom).toBeCloseTo(-(DEFAULT_ORTHO_SPAN / 2) * (900 / 600), 9);
    const frustumAspect = (camera.right - camera.left) / (camera.top - camera.bottom);
    expect(frustumAspect).toBeCloseTo(600 / 900, 9);
  });

  it("pans the center by exactly world-per-pixel along camera axes", () => {
    const controller = new GeometryOrthoController();
    controller.updateFrustum("xy", RECT);
    // worldPerPixel = span / min(800, 600) = 12/600 = 0.02.
    // xy camera right is +x and up is +z, so (+100px, +50px) moves the
    // center to (-2, 0, +1): content follows the pointer.
    controller.panByPixels("xy", 100, 50, RECT);
    const center = controller.getState("xy").center;
    expect(center.x).toBeCloseTo(-2, 9);
    expect(center.y).toBeCloseTo(0, 12);
    expect(center.z).toBeCloseTo(1, 9);
    // Cumulative drags accumulate from the updated center.
    controller.panByPixels("xy", 50, 0, RECT);
    expect(controller.getState("xy").center.x).toBeCloseTo(-3, 9);
  });

  it("clamps zoom to the documented extents and ignores invalid factors", () => {
    const controller = new GeometryOrthoController();
    controller.zoomByFactor("xy", 1e12);
    expect(controller.getState("xy").span).toBe(60_000);
    controller.zoomByFactor("xy", 1e-12);
    expect(controller.getState("xy").span).toBe(0.05);
    // Reset to a non-clamped span so the invalid-factor assertions below
    // prove the factor was ignored (not merely clamped to the minimum).
    controller.resetView("xy");
    expect(controller.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
    controller.zoomByFactor("xy", 0);
    expect(controller.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
    controller.zoomByFactor("xy", -2);
    expect(controller.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
    controller.zoomByFactor("xy", Number.NaN);
    expect(controller.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
  });

  it("keeps zoom independent per view and returns stable camera instances", () => {
    const controller = new GeometryOrthoController();
    controller.zoomByFactor("xy", 2);
    expect(controller.getState("xz").span).toBe(DEFAULT_ORTHO_SPAN);
    expect(controller.getCamera("xy")).toBe(controller.getCamera("xy"));
    expect(controller.getCamera("xy")).not.toBe(controller.getCamera("xz"));
  });
});

describe("GeometryOrthoController zoom and reset", () => {
  it("zooms around the center within clamped extents", () => {
    const controller = new GeometryOrthoController();
    controller.zoomByFactor("xy", 0.5);
    expect(controller.getState("xy").span).toBeCloseTo(DEFAULT_ORTHO_SPAN / 2, 9);
    controller.zoomByFactor("xy", 1e12);
    expect(Number.isFinite(controller.getState("xy").span)).toBe(true);
    controller.zoomByFactor("xy", 0);
    expect(controller.getState("xy").span).toBeGreaterThan(0);
    controller.zoomByFactor("xy", Number.NaN);
    expect(Number.isFinite(controller.getState("xy").span)).toBe(true);
  });

  it("resets center and span", () => {
    const controller = new GeometryOrthoController();
    controller.panByPixels("xz", 40, 40, RECT);
    controller.zoomByFactor("xz", 3);
    controller.resetView("xz");
    const state = controller.getState("xz");
    expect(state.center.length()).toBe(0);
    expect(state.span).toBe(DEFAULT_ORTHO_SPAN);
  });

  it("keeps independent state per view", () => {
    const controller = new GeometryOrthoController();
    controller.panByPixels("xy", 100, 0, RECT);
    expect(controller.getState("xz").center.length()).toBe(0);
  });
});
