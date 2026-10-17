// S33 interaction helpers: literal policy, drag formatter, frame bounds,
// clean-click threshold (pure, UI-only — zero engine changes).

import { describe, expect, it } from "vitest";
import {
  CANVAS_CLEAN_CLICK_PX,
  isCleanClick
} from "@/lib/interaction/canvasInteractionModel";
import {
  formatDragLiteral,
  isDirectManipulationNumericLiteral
} from "@/lib/interaction/directManipulationLiterals";
import {
  LINE_FRAME_RADIUS,
  MIN_FRAME_RADIUS,
  PLANE_FRAME_RADIUS,
  RAY_FRAME_RADIUS,
  frameBoundsFromPoints,
  frameBoundsLinePoint,
  frameBoundsPlaneAnchor,
  frameBoundsRayOrigin,
  unionFrameBounds
} from "@/lib/interaction/frameBounds";

describe("isDirectManipulationNumericLiteral", () => {
  it("accepts plain numeric literals", () => {
    for (const literal of ["0", "1", "-2.5", "3e-2", "+.5", "  2  ", "007", "-0.0", "1E10"]) {
      expect(isDirectManipulationNumericLiteral(literal)).toBe(true);
    }
  });

  it("locks expressions, parameters, folds, and named constants", () => {
    for (const locked of ["a", "a+1", "1+2", "sin(theta)", "pi", "", "   ", "0x10", "NaN", "Infinity", "1,000", "2;3"]) {
      expect(isDirectManipulationNumericLiteral(locked)).toBe(false);
    }
  });

  it("rejects non-strings", () => {
    expect(isDirectManipulationNumericLiteral(3 as unknown as string)).toBe(false);
    expect(isDirectManipulationNumericLiteral(null)).toBe(false);
    expect(isDirectManipulationNumericLiteral(undefined)).toBe(false);
  });
});

describe("formatDragLiteral", () => {
  it("formats finite values deterministically without noise", () => {
    expect(formatDragLiteral(0)).toBe("0");
    expect(formatDragLiteral(-0)).toBe("0");
    expect(formatDragLiteral(2)).toBe("2");
    expect(formatDragLiteral(1.999999999823)).toBe("2");
    expect(formatDragLiteral(-2.5)).toBe("-2.5");
    expect(formatDragLiteral(0.1 + 0.2)).toBe("0.3");
  });

  it("rejects non-finite values", () => {
    expect(formatDragLiteral(Number.NaN)).toBeNull();
    expect(formatDragLiteral(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDragLiteral(Number.NEGATIVE_INFINITY)).toBeNull();
  });
});

describe("isCleanClick", () => {
  it("uses the under-6px threshold", () => {
    expect(CANVAS_CLEAN_CLICK_PX).toBe(6);
    expect(isCleanClick(0, 0, 0, 0)).toBe(true);
    expect(isCleanClick(0, 0, 5.9, 0)).toBe(true);
    expect(isCleanClick(0, 0, 6, 0)).toBe(false);
    expect(isCleanClick(0, 0, 100, 100)).toBe(false);
    expect(isCleanClick(Number.NaN, 0, 0, 0)).toBe(false);
  });
});

describe("frameBoundsFromPoints", () => {
  it("fits finite clouds with padding and minimum radius", () => {
    expect(frameBoundsFromPoints([])).toBeNull();
    expect(frameBoundsFromPoints([{ x: 1, y: 2, z: 3 }])).toEqual({
      center: { x: 1, y: 2, z: 3 },
      radius: MIN_FRAME_RADIUS
    });
    const bounds = frameBoundsFromPoints([
      { x: -4, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 }
    ]);
    expect(bounds?.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds?.radius).toBeCloseTo(4 * 1.25, 9);
  });

  it("skips non-finite points", () => {
    expect(
      frameBoundsFromPoints([
        { x: Number.NaN, y: 0, z: 0 },
        { x: 2, y: 2, z: 2 }
      ])
    ).toEqual({ center: { x: 2, y: 2, z: 2 }, radius: MIN_FRAME_RADIUS });
    expect(
      frameBoundsFromPoints([{ x: Number.NaN, y: 0, z: 0 }])
    ).toBeNull();
  });
});

describe("infinite primitive framing uses local radii", () => {
  it("frames Line around its defining point", () => {
    expect(frameBoundsLinePoint({ x: 1, y: 2, z: 3 })).toEqual({
      center: { x: 1, y: 2, z: 3 },
      radius: LINE_FRAME_RADIUS
    });
    expect(frameBoundsLinePoint({ x: Number.NaN, y: 0, z: 0 })).toBeNull();
  });

  it("frames Ray around origin plus forward direction", () => {
    const bounds = frameBoundsRayOrigin({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(bounds?.radius).toBe(RAY_FRAME_RADIUS);
    expect(bounds?.center.x).toBeCloseTo(RAY_FRAME_RADIUS / 2, 9);
    // Zero direction degrades to the origin without NaNs.
    expect(frameBoundsRayOrigin({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 })).toEqual({
      center: { x: 1, y: 1, z: 1 },
      radius: RAY_FRAME_RADIUS
    });
  });

  it("frames Plane around its anchor", () => {
    expect(frameBoundsPlaneAnchor({ x: 0, y: 0, z: 5 })).toEqual({
      center: { x: 0, y: 0, z: 5 },
      radius: PLANE_FRAME_RADIUS
    });
  });
});

describe("unionFrameBounds", () => {
  it("unions bounds and skips nulls", () => {
    expect(unionFrameBounds([null, null])).toBeNull();
    const union = unionFrameBounds([
      { center: { x: 0, y: 0, z: 0 }, radius: 1 },
      { center: { x: 10, y: 0, z: 0 }, radius: 1 }
    ]);
    expect(union?.center.x).toBeCloseTo(5, 9);
    expect(union?.radius).toBeGreaterThan(5);
  });
});

describe("zoomTowardScreen", () => {
  it("keeps the cursor-anchored world point fixed across zoom", async () => {
    const { GeometryOrthoController } = await import("@/lib/graph3d/graphThreeOrthoViews");
    const { Raycaster, Vector2 } = await import("three");
    const ortho = new GeometryOrthoController();
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    const ndc = { x: 0.5, y: -0.25 };
    const worldAt = () => {
      const camera = ortho.getCamera("xy");
      ortho.updateFrustum("xy", rect);
      camera.updateMatrixWorld();
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
      const state = ortho.getState("xy");
      // Intersect the center plane (world y = center y for the xy pane).
      const t = (state.center.y - raycaster.ray.origin.y) / raycaster.ray.direction.y;
      return {
        x: raycaster.ray.origin.x + raycaster.ray.direction.x * t,
        z: raycaster.ray.origin.z + raycaster.ray.direction.z * t
      };
    };
    const before = worldAt();
    ortho.zoomTowardScreen("xy", ndc.x, ndc.y, rect, 0.5);
    const after = worldAt();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
    // Span actually zoomed in.
    expect(ortho.getState("xy").span).toBeCloseTo(12 * 0.5, 9);
  });
});

describe("resolveHandleWorldPositions", () => {
  it("resolves compiled anchors with non-literal siblings", async () => {
    const { resolveHandleWorldPositions } = await import("@/lib/graph3d/graphThreeInteractionHandles");
    const positions = resolveHandleWorldPositions({
      id: "p1",
      kind: "point",
      color: "#fff",
      visible: true,
      xExpr: "1+2",
      yExpr: "0",
      zExpr: "0"
    } as never);
    // S33-R3: drag anchors resolve through the compiler (not Number()),
    // so pane-local drags work when locked siblings still evaluate.
    expect(positions?.point).toEqual({ x: 3, y: 0, z: 0 });
  });
});
