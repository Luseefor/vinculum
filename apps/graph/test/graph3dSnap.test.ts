import { describe, expect, it } from "vitest";
import { snapWorldPoint } from "@/lib/graph3d/GraphThreeEngine";

describe("snapWorldPoint", () => {
  it("returns original point when snapping is disabled", () => {
    const point = { x: 1.234, y: -2.345, z: 3.456 };
    expect(snapWorldPoint(point, { enabled: false, step: 0.25 })).toEqual(point);
  });

  it("snaps each axis to the nearest step when enabled", () => {
    const point = { x: 1.24, y: -2.36, z: 0.11 };
    const snapped = snapWorldPoint(point, { enabled: true, step: 0.25 });
    expect(snapped).toEqual({ x: 1.25, y: -2.25, z: 0 });
  });

  it("ignores invalid snap step values", () => {
    const point = { x: 4.2, y: 5.1, z: -0.7 };
    expect(snapWorldPoint(point, { enabled: true, step: 0 })).toEqual(point);
    expect(snapWorldPoint(point, { enabled: true, step: Number.NaN })).toEqual(point);
  });
});
