import { describe, expect, it } from "vitest";
import {
  addVec3,
  clipLineToAabb,
  clipRayToAabb,
  clipSegmentToAabb,
  crossVec3,
  distanceVec3,
  dotVec3,
  isZeroVec3,
  lerpPoint3,
  magnitudeVec3,
  normalizeVec3,
  pointOnLine,
  pointOnRay,
  pointOnSegment,
  scaleVec3,
  subtractVec3,
  type AxisAlignedBox3
} from "@/lib/math/geometryPrimitives";

const UNIT_BOX: AxisAlignedBox3 = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } };

describe("pure vector operations (S26 PART 2)", () => {
  it("adds <1,2,3> + <4,5,6> = <5,7,9>", () => {
    expect(addVec3({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 });
  });

  it("dots <1,2,3>·<4,5,6> = 32", () => {
    expect(dotVec3({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32);
  });

  it("crosses <1,0,0>×<0,1,0> = <0,0,1>", () => {
    expect(crossVec3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("magnitudes <3,4,0> = 5", () => {
    expect(magnitudeVec3({ x: 3, y: 4, z: 0 })).toBe(5);
  });

  it("returns null (never NaN) for zero normalization", () => {
    expect(normalizeVec3({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(normalizeVec3({ x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 });
    expect(isZeroVec3({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(isZeroVec3({ x: 1, y: 0, z: 0 })).toBe(false);
  });

  it("subtracts, scales, distances, and lerps", () => {
    expect(subtractVec3({ x: 4, y: 5, z: 6 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 3, y: 3, z: 3 });
    expect(scaleVec3({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(distanceVec3({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(lerpPoint3({ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }, 0.5)).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe("parametric evaluation (S26 PART 9/36)", () => {
  it("evaluates P=(1,2,3) d=<2,-1,4> at t=2 as (5,0,11)", () => {
    const line = { point: { x: 1, y: 2, z: 3 }, direction: { x: 2, y: -1, z: 4 } };
    expect(pointOnLine(line, 0)).toEqual({ x: 1, y: 2, z: 3 });
    expect(pointOnLine(line, 2)).toEqual({ x: 5, y: 0, z: 11 });
    expect(pointOnLine(line, Number.NaN)).toBeNull();
  });

  it("rejects negative t for rays without clamping", () => {
    const ray = { origin: { x: 1, y: 1, z: 1 }, direction: { x: 1, y: 0, z: 0 } };
    expect(pointOnRay(ray, 3)).toEqual({ x: 4, y: 1, z: 1 });
    expect(pointOnRay(ray, -1)).toBeNull();
  });

  it("evaluates segments on [0,1] and rejects outside without clamping", () => {
    const segment = { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 4, z: 6 } };
    expect(pointOnSegment(segment, 0.5)).toEqual({ x: 1, y: 2, z: 3 });
    expect(pointOnSegment(segment, -0.1)).toBeNull();
    expect(pointOnSegment(segment, 1.1)).toBeNull();
  });
});

describe("AABB clipping (S26 PART 15)", () => {
  it("clips the x-axis line to (-1,0,0),(1,0,0)", () => {
    const clipped = clipLineToAabb(
      { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } },
      UNIT_BOX
    );
    expect(clipped?.entry).toEqual({ x: -1, y: 0, z: 0 });
    expect(clipped?.exit).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("clips the forward ray to (0,0,0),(1,0,0) and misses outward rays", () => {
    const forward = clipRayToAabb(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } },
      UNIT_BOX
    );
    expect(forward?.entry).toEqual({ x: 0, y: 0, z: 0 });
    expect(forward?.exit).toEqual({ x: 1, y: 0, z: 0 });
    expect(
      clipRayToAabb({ origin: { x: 2, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, UNIT_BOX)
    ).toBeNull();
  });

  it("misses parallel-outside lines and pins a diagonal", () => {
    expect(
      clipLineToAabb({ point: { x: 0, y: 2, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, UNIT_BOX)
    ).toBeNull();
    const diagonal = clipLineToAabb(
      { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 1, z: 1 } },
      UNIT_BOX
    );
    expect(diagonal?.entry).toEqual({ x: -1, y: -1, z: -1 });
    expect(diagonal?.exit).toEqual({ x: 1, y: 1, z: 1 });
    // Negative direction traverses the same geometric line.
    const negative = clipLineToAabb(
      { point: { x: 0, y: 0, z: 0 }, direction: { x: -1, y: -1, z: -1 } },
      UNIT_BOX
    );
    expect(negative?.entry).toEqual({ x: 1, y: 1, z: 1 });
    expect(negative?.exit).toEqual({ x: -1, y: -1, z: -1 });
  });

  it("keeps coincident segment endpoints as valid point-degenerate clips", () => {
    const inside = clipSegmentToAabb(
      { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } },
      UNIT_BOX
    );
    expect(inside?.entry).toEqual({ x: 0, y: 0, z: 0 });
    expect(
      clipSegmentToAabb({ start: { x: 5, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 } }, UNIT_BOX)
    ).toBeNull();
  });

  it("returns null for zero directions without NaN", () => {
    const zero = { x: 0, y: 0, z: 0 };
    expect(clipLineToAabb({ point: { x: 0, y: 0, z: 0 }, direction: zero }, UNIT_BOX)).toBeNull();
    expect(clipRayToAabb({ origin: { x: 0, y: 0, z: 0 }, direction: zero }, UNIT_BOX)).toBeNull();
  });
});
