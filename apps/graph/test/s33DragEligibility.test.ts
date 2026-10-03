// S33 drag eligibility: pane-aware numeric-literal locks.

import { describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import {
  DRAG_LOCK_HINT,
  eligibleDragHandles,
  paneEditedAxes
} from "@/lib/interaction/dragEligibility";

function point(overrides: Record<string, string> = {}): GraphObject {
  return {
    id: "p1",
    kind: "point",
    color: "#fff",
    visible: true,
    xExpr: "1",
    yExpr: "2",
    zExpr: "3",
    ...overrides
  } as GraphObject;
}

function vector(overrides: Record<string, string> = {}): GraphObject {
  return {
    id: "v1",
    kind: "vector",
    color: "#fff",
    visible: true,
    oxExpr: "0",
    oyExpr: "0",
    ozExpr: "0",
    vxExpr: "1",
    vyExpr: "0",
    vzExpr: "0",
    ...overrides
  } as GraphObject;
}

function segment(overrides: Record<string, string> = {}): GraphObject {
  return {
    id: "s1",
    kind: "segment",
    color: "#fff",
    visible: true,
    axExpr: "0",
    ayExpr: "0",
    azExpr: "0",
    bxExpr: "1",
    byExpr: "1",
    bzExpr: "1",
    ...overrides
  } as GraphObject;
}

function line(overrides: Record<string, string> = {}): GraphObject {
  return {
    id: "l1",
    kind: "line",
    color: "#fff",
    visible: true,
    pxExpr: "0",
    pyExpr: "0",
    pzExpr: "0",
    dxExpr: "1",
    dyExpr: "0",
    dzExpr: "0",
    ...overrides
  } as GraphObject;
}

function ray(overrides: Record<string, string> = {}): GraphObject {
  return {
    id: "r1",
    kind: "ray",
    color: "#fff",
    visible: true,
    oxExpr: "0",
    oyExpr: "0",
    ozExpr: "0",
    dxExpr: "1",
    dyExpr: "0",
    dzExpr: "0",
    ...overrides
  } as GraphObject;
}

describe("paneEditedAxes", () => {
  it("maps panes to edited math axes with hidden axis preserved", () => {
    expect(paneEditedAxes("xy")).toEqual(["x", "y"]);
    expect(paneEditedAxes("xz")).toEqual(["x", "z"]);
    expect(paneEditedAxes("yz")).toEqual(["y", "z"]);
  });
});

describe("eligibleDragHandles", () => {
  it("supports literal-backed Points in every pane", () => {
    expect(eligibleDragHandles(point(), "xy")).toEqual([{ handle: "point" }]);
    expect(eligibleDragHandles(point(), "xz")).toEqual([{ handle: "point" }]);
    expect(eligibleDragHandles(point(), "yz")).toEqual([{ handle: "point" }]);
  });

  it("locks expression-backed coordinates per pane (PART 55)", () => {
    // x="a": XY and XZ locked (require x), YZ still draggable (y/z literal).
    const mixed = point({ xExpr: "a" });
    expect(eligibleDragHandles(mixed, "xy")).toEqual([]);
    expect(eligibleDragHandles(mixed, "xz")).toEqual([]);
    expect(eligibleDragHandles(mixed, "yz")).toEqual([{ handle: "point" }]);
  });

  it("locks constant-foldable text and named constants", () => {
    expect(eligibleDragHandles(point({ yExpr: "1+2" }), "xy")).toEqual([]);
    expect(eligibleDragHandles(point({ zExpr: "pi" }), "xz")).toEqual([]);
  });

  it("splits Segment endpoints independently", () => {
    expect(eligibleDragHandles(segment(), "xy")).toEqual([{ handle: "start" }, { handle: "end" }]);
    const lockedStart = segment({ axExpr: "t" });
    expect(eligibleDragHandles(lockedStart, "xy")).toEqual([{ handle: "end" }]);
    expect(eligibleDragHandles(lockedStart, "yz")).toEqual([{ handle: "start" }, { handle: "end" }]);
  });

  it("splits Vector origin and tip independently (PART 56)", () => {
    expect(eligibleDragHandles(vector(), "xy")).toEqual([{ handle: "origin" }, { handle: "tip" }]);
    // Expression-backed components lock tip only; origin stays draggable.
    const mixed = vector({ vxExpr: "a" });
    expect(eligibleDragHandles(mixed, "xy")).toEqual([{ handle: "origin" }]);
    expect(eligibleDragHandles(mixed, "yz")).toEqual([{ handle: "origin" }, { handle: "tip" }]);
  });

  it("supports Line defining point and Ray origin only (direction deferred)", () => {
    expect(eligibleDragHandles(line(), "xy")).toEqual([{ handle: "point" }]);
    expect(eligibleDragHandles(line({ pxExpr: "a+1" }), "xy")).toEqual([]);
    expect(eligibleDragHandles(ray(), "xz")).toEqual([{ handle: "origin" }]);
    expect(eligibleDragHandles(ray({ ozExpr: "sin(t)" }), "xz")).toEqual([]);
  });

  it("rejects unsupported kinds", () => {
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
    expect(eligibleDragHandles(surface, "xy")).toEqual([]);
    const plane = { id: "pl", kind: "plane" } as GraphObject;
    expect(eligibleDragHandles(plane, "xy")).toEqual([]);
  });

  it("exposes a concise lock hint", () => {
    expect(DRAG_LOCK_HINT).toBe("Edit expression in Object panel.");
  });
});
