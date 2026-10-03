import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import {
  computePaneRects,
  ORTHO_CAMERA_ORIENTATION,
  paneLocalNDC,
  projectMathPointToPane,
  resolveGeometryPanes,
  routePointerToPaneIndex
} from "@/lib/graph3d/graphThreeGeometryViews";

describe("resolveGeometryPanes", () => {
  it("single shows exactly the primary view", () => {
    expect(resolveGeometryPanes("single", "xz", "xy")).toEqual(["xz"]);
  });

  it("split is perspective plus the selected orthographic plane", () => {
    expect(resolveGeometryPanes("split", "xy", "yz")).toEqual(["perspective", "yz"]);
  });

  it("split never duplicates perspective", () => {
    expect(resolveGeometryPanes("split", "perspective", "perspective")).toEqual(["perspective", "xy"]);
  });

  it("quad is the fixed four-pane composition", () => {
    expect(resolveGeometryPanes("quad", "xy", "xy")).toEqual(["perspective", "xy", "xz", "yz"]);
  });
});

describe("computePaneRects", () => {
  it("single fills the area", () => {
    expect(computePaneRects(["xy"], 1440, 900)).toEqual([{ left: 0, top: 0, width: 1440, height: 900 }]);
  });

  it("split divides horizontally and tiles exactly", () => {
    const rects = computePaneRects(["perspective", "xy"], 1441, 900);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ left: 0, top: 0, width: 720, height: 900 });
    expect(rects[1]).toEqual({ left: 720, top: 0, width: 721, height: 900 });
  });

  it("quad divides into a 2x2 grid that tiles exactly", () => {
    const rects = computePaneRects(["perspective", "xy", "xz", "yz"], 1441, 901);
    expect(rects).toHaveLength(4);
    expect(rects[0]).toEqual({ left: 0, top: 0, width: 720, height: 450 });
    expect(rects[1]).toEqual({ left: 720, top: 0, width: 721, height: 450 });
    expect(rects[2]).toEqual({ left: 0, top: 450, width: 720, height: 451 });
    expect(rects[3]).toEqual({ left: 720, top: 450, width: 721, height: 451 });
  });

  it("clamps degenerate sizes to a minimum 1px pane", () => {
    expect(computePaneRects(["xy"], 0, -5)).toEqual([{ left: 0, top: 0, width: 1, height: 1 }]);
  });
});

describe("routePointerToPaneIndex", () => {
  const rects = computePaneRects(["perspective", "xy", "xz", "yz"], 1000, 800);

  it.each([
    { x: 100, y: 100, pane: 0 },
    { x: 900, y: 100, pane: 1 },
    { x: 100, y: 700, pane: 2 },
    { x: 900, y: 700, pane: 3 }
  ])("routes ($x,$y) to pane $pane", ({ x, y, pane }) => {
    expect(routePointerToPaneIndex(rects, x, y)).toBe(pane);
  });

  it("assigns divider lines deterministically to right/bottom panes", () => {
    expect(routePointerToPaneIndex(rects, 500, 100)).toBe(1);
    expect(routePointerToPaneIndex(rects, 100, 400)).toBe(2);
  });

  it("clamps out-of-area pointers instead of returning dead zones", () => {
    expect(routePointerToPaneIndex(rects, -50, -50)).toBe(0);
    expect(routePointerToPaneIndex(rects, 5000, 5000)).toBe(3);
  });

  it("returns -1 for an empty pane list", () => {
    expect(routePointerToPaneIndex([], 10, 10)).toBe(-1);
  });
});

describe("paneLocalNDC", () => {
  const rect = { left: 500, top: 400, width: 500, height: 400 };

  it("maps corners and center with three.js Y-flip", () => {
    expect(paneLocalNDC(rect, 500, 400)).toEqual({ x: -1, y: 1 });
    expect(paneLocalNDC(rect, 1000, 800)).toEqual({ x: 1, y: -1 });
    expect(paneLocalNDC(rect, 750, 600)).toEqual({ x: 0, y: 0 });
  });

  it("is DPR-independent (CSS coordinates in, NDC out)", () => {
    expect(paneLocalNDC({ left: 0, top: 0, width: 200, height: 100 }, 50, 25)).toEqual({ x: -0.5, y: 0.5 });
  });
});

describe("orthographic camera orientation (no mirroring)", () => {
  const mathToWorld = (point: { x: number; y: number; z: number }) =>
    new Vector3(point.x, point.z, point.y);
  // Deliberately asymmetric: every axis differs in sign and magnitude.
  const a = { x: 1, y: 2, z: 3 };
  const b = { x: -4, y: 5, z: -6 };

  function projectNdc(view: "xy" | "xz" | "yz", point: { x: number; y: number; z: number }) {
    const orientation = ORTHO_CAMERA_ORIENTATION[view];
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.set(
      orientation.positionDirection[0] * 50,
      orientation.positionDirection[1] * 50,
      orientation.positionDirection[2] * 50
    );
    camera.up.set(orientation.up[0], orientation.up[1], orientation.up[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return mathToWorld(point).clone().project(camera);
  }

  it.each([
    { view: "xy" as const, a: { h: 1, v: 1 }, b: { h: -1, v: 1 } },
    { view: "xz" as const, a: { h: 1, v: 1 }, b: { h: -1, v: -1 } },
    { view: "yz" as const, a: { h: 1, v: 1 }, b: { h: 1, v: -1 } }
  ])("$view camera signs match the pane contract", ({ view, a: expectedA, b: expectedB }) => {
    const contractA = projectMathPointToPane(view, a);
    const contractB = projectMathPointToPane(view, b);
    expect(contractA && Math.sign(contractA.h)).toBe(expectedA.h);
    expect(contractA && Math.sign(contractA.v)).toBe(expectedA.v);
    expect(contractB && Math.sign(contractB.h)).toBe(expectedB.h);
    expect(contractB && Math.sign(contractB.v)).toBe(expectedB.v);
    const ndcA = projectNdc(view, a);
    const ndcB = projectNdc(view, b);
    expect(Math.sign(ndcA.x)).toBe(expectedA.h);
    expect(Math.sign(ndcA.y)).toBe(expectedA.v);
    expect(Math.sign(ndcB.x)).toBe(expectedB.h);
    expect(Math.sign(ndcB.y)).toBe(expectedB.v);
  });

  it("contract mapping matches spec values exactly", () => {
    expect(projectMathPointToPane("xy", a)).toEqual({ h: 1, v: 2 });
    expect(projectMathPointToPane("xy", b)).toEqual({ h: -4, v: 5 });
    expect(projectMathPointToPane("xz", a)).toEqual({ h: 1, v: 3 });
    expect(projectMathPointToPane("xz", b)).toEqual({ h: -4, v: -6 });
    expect(projectMathPointToPane("yz", a)).toEqual({ h: 2, v: 3 });
    expect(projectMathPointToPane("yz", b)).toEqual({ h: 5, v: -6 });
    expect(projectMathPointToPane("perspective", a)).toBeNull();
  });
});

describe("degenerate pane contracts", () => {
  it("paneLocalNDC returns origin for zero-size rects", () => {
    expect(paneLocalNDC({ left: 0, top: 0, width: 0, height: 100 }, 10, 10)).toEqual({ x: 0, y: 0 });
    expect(paneLocalNDC({ left: 0, top: 0, width: 100, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it("routePointerToPaneIndex skips zero-size rects and clamps empty lists", () => {
    expect(routePointerToPaneIndex([], 50, 50)).toBe(-1);
    expect(
      routePointerToPaneIndex(
        [
          { left: 0, top: 0, width: 0, height: 0 },
          { left: 0, top: 0, width: 100, height: 100 }
        ],
        50,
        50
      )
    ).toBe(1);
    // All zero-size: no dead click, falls back to index 0.
    expect(routePointerToPaneIndex([{ left: 0, top: 0, width: 0, height: 0 }], 50, 50)).toBe(0);
  });

  it("computePaneRects documents its edge inputs", () => {
    // Zero panes fall back to a single full-area rect (safe fallback branch).
    expect(computePaneRects([], 1440, 900)).toEqual([{ left: 0, top: 0, width: 1440, height: 900 }]);
    // Three (or 5+) panes are unreachable in production: setGeometryMultiViewPanes
    // rejects any length outside single/split/quad. The helper falls back to
    // a single full-area rect instead of tiling a mismatched grid.
    expect(computePaneRects(["perspective", "xy", "xz"], 1440, 900)).toEqual([
      { left: 0, top: 0, width: 1440, height: 900 }
    ]);
  });
});
