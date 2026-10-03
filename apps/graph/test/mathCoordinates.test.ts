import { describe, it, expect } from "vitest";
import {
  mathToWorld3D,
  projectMathToPair2D,
  worldIndexForMathAxis,
  worldToMath3D,
  type MathAxis,
  type MathAxisPair,
  type MathPoint3,
  type WorldPoint3
} from "@/lib/math/coordinates";

// S3-U2: pure coordinate utility tests. Covers mapping, inverse, round trip,
// all three 2D projections, and sign/zero/fractional edge values.

describe("math coordinates", () => {
  it("maps math(x,y,z) to world(x,z,y) with world Y up", () => {
    expect(mathToWorld3D({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: 2 });
  });

  it("inverts world(x,y,z) back to math(x,z,y)", () => {
    expect(worldToMath3D({ x: 1, y: 3, z: 2 })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("round-trips math -> world -> math exactly", () => {
    const points: MathPoint3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
      { x: -4.5, y: 0.125, z: -7.25 },
      { x: 10000, y: -10000, z: 0.5 }
    ];
    for (const point of points) {
      expect(worldToMath3D(mathToWorld3D(point))).toEqual(point);
    }
  });

  it("round-trips world -> math -> world exactly", () => {
    const points: WorldPoint3[] = [
      { x: 0, y: 0, z: 0 },
      { x: -1.5, y: 2.25, z: -3.75 }
    ];
    for (const point of points) {
      expect(mathToWorld3D(worldToMath3D(point))).toEqual(point);
    }
  });

  it("projects XY as (x, y)", () => {
    expect(projectMathToPair2D({ x: 1, y: 2, z: 3 }, "xy")).toEqual({
      horizontal: 1,
      vertical: 2
    });
  });

  it("projects XZ as (x, z)", () => {
    expect(projectMathToPair2D({ x: 1, y: 2, z: 3 }, "xz")).toEqual({
      horizontal: 1,
      vertical: 3
    });
  });

  it("projects YZ as (y, z)", () => {
    expect(projectMathToPair2D({ x: 1, y: 2, z: 3 }, "yz")).toEqual({
      horizontal: 2,
      vertical: 3
    });
  });

  it("handles negative, fractional, and zero values across all pairs", () => {    const point: MathPoint3 = { x: -2.5, y: 0, z: 4.75 };
    const expected: Record<MathAxisPair, { horizontal: number; vertical: number }> = {
      xy: { horizontal: -2.5, vertical: 0 },
      xz: { horizontal: -2.5, vertical: 4.75 },
      yz: { horizontal: 0, vertical: 4.75 }
    };
    (Object.keys(expected) as MathAxisPair[]).forEach((pair) => {
      expect(projectMathToPair2D(point, pair)).toEqual(expected[pair]);
    });
    expect(mathToWorld3D(point)).toEqual({ x: -2.5, y: 4.75, z: 0 });
    expect(worldToMath3D({ x: -2.5, y: 4.75, z: 0 })).toEqual(point);
  });

  it("resolves mathematical axes to world tuple indices (x->0, y->2, z->1)", () => {
    expect(worldIndexForMathAxis("x")).toBe(0);
    expect(worldIndexForMathAxis("y")).toBe(2);
    expect(worldIndexForMathAxis("z")).toBe(1);
  });

  it("reads the same components as the canonical mapping for varied values", () => {
    const mathPoints: MathPoint3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
      { x: -2.5, y: 0.125, z: -7.75 }
    ];
    const axes: MathAxis[] = ["x", "y", "z"];
    for (const mathPoint of mathPoints) {
      const world = mathToWorld3D(mathPoint);
      const tuple = [world.x, world.y, world.z];
      for (const axis of axes) {
        expect(tuple[worldIndexForMathAxis(axis)]).toBe(mathPoint[axis]);
      }
    }
  });

  it("inverts through worldToMath3D component lookup", () => {
    const world: WorldPoint3 = { x: -2.5, y: 4.75, z: 0 };
    const tuple = [world.x, world.y, world.z];
    const math = worldToMath3D(world);
    expect(tuple[worldIndexForMathAxis("x")]).toBe(math.x);
    expect(tuple[worldIndexForMathAxis("y")]).toBe(math.y);
    expect(tuple[worldIndexForMathAxis("z")]).toBe(math.z);
  });
});
