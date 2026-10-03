import { describe, expect, it } from "vitest";
import {
  resolveScalarRange,
  scalarColorForT,
  scalarColorForValue,
  scalarValueToT
} from "@/lib/math/scalarColorPolicy";

function luminance([r, g, b]: [number, number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("scalar range policy (S23 PART 9/26)", () => {
  it("selects diverging only when the range strictly spans zero", () => {
    expect(resolveScalarRange(0, 50, 100).mode).toBe("sequential");
    expect(resolveScalarRange(-50, 0, 100).mode).toBe("sequential");
    expect(resolveScalarRange(-50, 50, 100).mode).toBe("diverging");
    expect(resolveScalarRange(5, 5, 100).mode).toBe("constant");
    expect(resolveScalarRange(0, 0, 0).mode).toBe("empty");
  });

  it("maps min/mid/max and pins zero at the diverging center", () => {
    const sequential = resolveScalarRange(0, 50, 100);
    expect(scalarValueToT(0, sequential)).toBe(0);
    expect(scalarValueToT(50, sequential)).toBe(1);
    expect(scalarValueToT(25, sequential)).toBeCloseTo(0.5, 12);
    const diverging = resolveScalarRange(-50, 50, 100);
    expect(scalarValueToT(0, diverging)).toBeCloseTo(0.5, 12);
    expect(scalarValueToT(-50, diverging)).toBe(0);
    expect(scalarValueToT(50, diverging)).toBe(1);
    // Asymmetric diverging range still centers data zero.
    const asymmetric = resolveScalarRange(-10, 30, 100);
    expect(scalarValueToT(0, asymmetric)).toBeCloseTo(0.5, 12);
  });

  it("renders constant fields with a stable mid color (no division by zero)", () => {
    const constant = resolveScalarRange(5, 5, 100);
    expect(scalarValueToT(5, constant)).toBe(0.5);
    const color = scalarColorForValue(5, constant);
    expect(color[3]).toBeGreaterThan(0);
    expect(color.slice(0, 3).every((c) => Number.isFinite(c))).toBe(true);
  });

  it("renders invalid samples transparent", () => {
    const range = resolveScalarRange(0, 10, 100);
    expect(scalarColorForValue(Number.NaN, range)).toEqual([0, 0, 0, 0]);
    expect(scalarColorForValue(5, resolveScalarRange(0, 0, 0))).toEqual([0, 0, 0, 0]);
    expect(scalarColorForT(Number.NaN, "sequential")).toEqual([0, 0, 0, 0]);
  });

  it("keeps sequential luminance strictly decreasing (brightness reads order)", () => {
    const samples = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) =>
      luminance(scalarColorForT(t, "sequential"))
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeLessThan(samples[i - 1] as number);
    }
  });

  it("emits finite bytes for the full sweep", () => {
    for (const mode of ["sequential", "diverging", "constant"] as const) {
      for (let k = 0; k <= 20; k += 1) {
        const color = scalarColorForT(k / 20, mode);
        expect(color).toHaveLength(4);
        for (const channel of color) {
          expect(Number.isInteger(channel)).toBe(true);
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});
