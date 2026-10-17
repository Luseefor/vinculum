// S33 frame bounds adapters + camera appliers (presentation-only).

import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import {
  fitSceneBounds,
  frameBoundsForObject,
  frameOrthoPane,
  framePerspectiveCamera,
  type ReadNodeBox
} from "@/lib/graph3d/graphThreeFrameCamera";
import { GeometryOrthoController } from "@/lib/graph3d/graphThreeOrthoViews";

const nullBox: ReadNodeBox = () => null;

function point(id = "p1", overrides: Record<string, string> = {}): GraphObject {
  return {
    id,
    kind: "point",
    color: "#fff",
    visible: true,
    xExpr: "1",
    yExpr: "2",
    zExpr: "3",
    ...overrides
  } as GraphObject;
}

describe("frameBoundsForObject", () => {
  it("frames Points at their resolved position with minimum radius", () => {
    const bounds = frameBoundsForObject(point(), nullBox);
    expect(bounds?.center).toEqual({ x: 1, y: 2, z: 3 });
    expect(bounds?.radius).toBe(1.5);
  });

  it("skips hidden objects", () => {
    expect(frameBoundsForObject({ ...point(), visible: false } as GraphObject, nullBox)).toBeNull();
  });

  it("frames Lines around the defining point (never the clipped extent)", () => {
    const object = {
      id: "l1",
      kind: "line",
      color: "#fff",
      visible: true,
      pxExpr: "4",
      pyExpr: "5",
      pzExpr: "6",
      dxExpr: "1",
      dyExpr: "0",
      dzExpr: "0"
    } as GraphObject;
    const bounds = frameBoundsForObject(object, nullBox);
    expect(bounds?.center).toEqual({ x: 4, y: 5, z: 6 });
    expect(bounds?.radius).toBe(6);
  });

  it("frames Rays around origin plus forward direction", () => {
    const object = {
      id: "r1",
      kind: "ray",
      color: "#fff",
      visible: true,
      oxExpr: "0",
      oyExpr: "0",
      ozExpr: "0",
      dxExpr: "0",
      dyExpr: "0",
      dzExpr: "1"
    } as GraphObject;
    const bounds = frameBoundsForObject(object, nullBox);
    expect(bounds?.radius).toBe(6);
    expect(bounds?.center.z).toBeCloseTo(3, 9);
  });

  it("frames finite mesh kinds from node boxes (world→math converted)", () => {
    const readBox: ReadNodeBox = () => ({
      // World box spanning x∈[0,2], y∈[0,4] (= math z), z∈[0,6] (= math y).
      min: { x: 0, y: 0, z: 0 },
      max: { x: 2, y: 4, z: 6 }
    });
    const object = {
      id: "s1",
      kind: "surface",
      color: "#fff",
      visible: true,
      equation: "x",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 8,
      appearance: { wireframe: false }
    } as GraphObject;
    const bounds = frameBoundsForObject(object, readBox);
    // Math frame: x∈[0,2], y∈[0,6], z∈[0,4] → center (1,3,2).
    expect(bounds?.center).toEqual({ x: 1, y: 3, z: 2 });
  });

  it("returns null for unresolvable or box-less objects", () => {
    expect(frameBoundsForObject(point("p", { xExpr: "zzz" }), nullBox)).toBeNull();
    const surface = {
      id: "s",
      kind: "surface",
      color: "#fff",
      visible: true,
      equation: "x",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 8,
      appearance: { wireframe: false }
    } as GraphObject;
    expect(frameBoundsForObject(surface, nullBox)).toBeNull();
  });
});

describe("fitSceneBounds", () => {
  it("unions visible object bounds", () => {
    const bounds = fitSceneBounds([point("a"), point("b", { xExpr: "9", yExpr: "2", zExpr: "3" })], nullBox);
    expect(bounds?.center.x).toBeCloseTo(5, 9);
  });

  it("is null for empty or fully hidden scenes", () => {
    expect(fitSceneBounds([], nullBox)).toBeNull();
    expect(fitSceneBounds([{ ...point(), visible: false } as GraphObject], nullBox)).toBeNull();
  });
});

describe("framePerspectiveCamera", () => {
  it("keeps direction, retargets, and fits distance without touching math", () => {
    const camera = new PerspectiveCamera(48, 1, 0.1, 80000);
    camera.position.set(10, 10, 10);
    const target = new Vector3(0, 0, 0);
    let updated = 0;
    const ok = framePerspectiveCamera(
      camera,
      { target, minDistance: 1.5, maxDistance: 80000, update: () => { updated += 1; } },
      { center: { x: 4, y: 0, z: 0 }, radius: 2 }
    );
    expect(ok).toBe(true);
    expect(updated).toBe(1);
    // World-frame target: math (4,0,0) → world (4,0,0).
    expect(target.x).toBeCloseTo(4, 9);
    const distance = camera.position.distanceTo(target);
    expect(distance).toBeGreaterThan(2);
    // Direction preserved (still along (1,1,1)).
    const direction = camera.position.clone().sub(target).normalize();
    expect(direction.x).toBeCloseTo(1 / Math.sqrt(3), 6);
  });
});

describe("frameOrthoPane", () => {
  it("centers the pane and fits span without rotating", () => {
    const ortho = new GeometryOrthoController();
    const before = ortho.getState("xy").span;
    const ok = frameOrthoPane(ortho, "xy", { center: { x: 5, y: 5, z: 0 }, radius: 2 });
    expect(ok).toBe(true);
    const state = ortho.getState("xy");
    // World center: math (5,5,0) → world (5,0,5).
    expect(state.center.x).toBeCloseTo(5, 9);
    expect(state.center.y).toBeCloseTo(0, 9);
    expect(state.center.z).toBeCloseTo(5, 9);
    expect(state.span).not.toBe(before);
    expect(state.span).toBeCloseTo(2 * 2 * 1.3, 6);
  });
});
