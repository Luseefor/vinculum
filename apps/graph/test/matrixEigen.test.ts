import { describe, expect, it } from "vitest";
import { analyzeEigen, formatComplexValue } from "@/lib/math/matrixEigen";

describe("eigen analysis (S28 PART 8-9)", () => {
  it("resolves diagonal 2D eigenvalues to coordinate axes", () => {
    const analysis = analyzeEigen([2, 0, 0, 3], 2);
    expect(analysis.unavailable).toBe(false);
    expect(analysis.realDirectionCount).toBe(2);
    const [first, second] = analysis.entries;
    expect(first).toMatchObject({ kind: "real", value: 2 });
    expect(second).toMatchObject({ kind: "real", value: 3 });
    if (first?.kind === "real") {
      expect(first.vector[0]).toBeCloseTo(1, 9);
      expect(first.vector[1]).toBeCloseTo(0, 9);
    }
  });

  it("reports no real eigendirections for 90° rotation (never fake arrows)", () => {
    const analysis = analyzeEigen([0, -1, 1, 0], 2);
    expect(analysis.unavailable).toBe(false);
    expect(analysis.realDirectionCount).toBe(0);
    expect(analysis.entries.filter((entry) => entry.kind === "real")).toHaveLength(0);
    const complex = analysis.entries.filter((entry) => entry.kind === "complex");
    expect(complex).toHaveLength(2);
    expect(formatComplexValue({ re: 0, im: 1 })).toBe("i");
    expect(formatComplexValue({ re: 0, im: -1 })).toBe("-i");
  });

  it("finds exactly one independent direction for shear (defective honesty)", () => {
    const analysis = analyzeEigen([1, 1, 0, 1], 2);
    expect(analysis.realDirectionCount).toBe(1);
    const real = analysis.entries.filter((entry) => entry.kind === "real");
    expect(real).toHaveLength(1);
    expect(real[0]).toMatchObject({ kind: "real", value: 1 });
  });

  it("resolves reflection eigendirections on both axes", () => {
    const analysis = analyzeEigen([-1, 0, 0, 1], 2);
    expect(analysis.realDirectionCount).toBe(2);
    const values = analysis.entries
      .filter((entry) => entry.kind === "real")
      .map((entry) => (entry as { value: number }).value)
      .sort((a, b) => a - b);
    expect(values).toEqual([-1, 1]);
  });

  it("resolves 3D diagonal and asymmetric eigensystems", () => {
    const diagonal = analyzeEigen([2, 0, 0, 0, 3, 0, 0, 0, 4], 3);
    expect(diagonal.realDirectionCount).toBe(3);
    expect(diagonal.entries.map((entry) => (entry as { value: number }).value)).toEqual([2, 3, 4]);
    const asymmetric = analyzeEigen([1, 2, 3, 0, 4, 5, 0, 0, 6], 3);
    expect(asymmetric.unavailable).toBe(false);
    const values = asymmetric.entries
      .filter((entry) => entry.kind === "real")
      .map((entry) => (entry as { value: number }).value);
    expect(values).toEqual([1, 4, 6]);
    // A v ≈ λ v for every returned pair (PART 52 cross-check).
    for (const entry of asymmetric.entries) {
      if (entry.kind !== "real") {
        continue;
      }
      expect(entry.residual).toBeLessThan(1e-6);
    }
  });

  it("orders real eigenvalues ascending regardless of library order", () => {
    const analysis = analyzeEigen([3, 0, 0, 2], 2);
    const values = analysis.entries
      .filter((entry) => entry.kind === "real")
      .map((entry) => (entry as { value: number }).value);
    expect(values).toEqual([2, 3]);
  });

  it("marks solver garbage unavailable instead of rendering fakes", () => {
    const analysis = analyzeEigen([Number.NaN, 0, 0, 1], 2);
    expect(analysis.unavailable).toBe(true);
    expect(analyzeEigen([1, 0], 2).unavailable).toBe(true);
  });
});
