import { describe, expect, it } from "vitest";
import { computeIndexedBoundingSphereData } from "@/lib/math/indexedBounds";

describe("computeIndexedBoundingSphereData", () => {
  it("computes exact center and radius for a single referenced triangle", () => {
    const positions = new Float32Array([0, 0, 0, 4, 0, 0, 0, 0, 3]);
    const indices = new Uint16Array([0, 1, 2]);
    const bounds = computeIndexedBoundingSphereData(positions, indices);
    expect(bounds).not.toBeNull();
    if (!bounds) {
      return;
    }
    expect(bounds.centerX).toBeCloseTo(2, 12);
    expect(bounds.centerY).toBeCloseTo(0, 12);
    expect(bounds.centerZ).toBeCloseTo(1.5, 12);
    expect(bounds.radius).toBeCloseTo(2.5, 12);
  });

  it("ignores an unreferenced extreme outlier completely", () => {
    const positions = new Float32Array([
      0, 0, 0,
      2, 0, 0,
      0, 0, 2,
      1e6, -1e6, 1e6
    ]);
    const referenced = computeIndexedBoundingSphereData(positions, new Uint16Array([0, 1, 2]));
    const polluted = new Float32Array(positions);
    expect(referenced).not.toBeNull();
    if (!referenced) {
      return;
    }
    expect(referenced.centerX).toBeCloseTo(1, 12);
    expect(referenced.centerY).toBeCloseTo(0, 12);
    expect(referenced.centerZ).toBeCloseTo(1, 12);
    expect(referenced.radius).toBeCloseTo(Math.SQRT2, 12);
    expect(polluted[9]).toBe(1e6);
  });

  it("produces the same result with duplicated index references", () => {
    const positions = new Float32Array([0, 0, 0, 4, 0, 0, 0, 0, 3, 999, 999, 999]);
    const single = computeIndexedBoundingSphereData(positions, new Uint16Array([0, 1, 2]));
    const duplicated = computeIndexedBoundingSphereData(
      positions,
      new Uint16Array([0, 1, 2, 2, 1, 0, 0, 0, 1, 1, 2, 2])
    );
    expect(single).not.toBeNull();
    expect(duplicated).not.toBeNull();
    if (!single || !duplicated) {
      return;
    }
    expect(duplicated.centerX).toBe(single.centerX);
    expect(duplicated.centerY).toBe(single.centerY);
    expect(duplicated.centerZ).toBe(single.centerZ);
    expect(duplicated.radius).toBe(single.radius);
  });

  it("returns null for empty indices", () => {
    expect(computeIndexedBoundingSphereData(new Float32Array([1, 2, 3]), new Uint16Array(0))).toBeNull();
    expect(computeIndexedBoundingSphereData(new Float32Array(0), new Uint16Array(0))).toBeNull();
  });

  it("treats coordinates axis-symmetrically with no math-axis semantics", () => {
    const positions = new Float32Array([10, 100, 1000, 14, 100, 1000, 10, 104, 1000]);
    const bounds = computeIndexedBoundingSphereData(positions, new Uint16Array([0, 1, 2]));
    expect(bounds).not.toBeNull();
    if (!bounds) {
      return;
    }
    expect(bounds.centerX).toBeCloseTo(12, 12);
    expect(bounds.centerY).toBeCloseTo(102, 12);
    expect(bounds.centerZ).toBeCloseTo(1000, 12);
    expect(bounds.radius).toBeCloseTo(Math.sqrt(8), 12);
  });
});
