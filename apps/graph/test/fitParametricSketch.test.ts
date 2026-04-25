import { describe, expect, it } from "vitest";
import {
  fitParametricSketch,
  formatPolynomialExpression
} from "@/lib/math/fitParametricSketch";

describe("fitParametricSketch", () => {
  it("fits a straight segment with low degree", () => {
    const points = Array.from({ length: 32 }, (_, index) => {
      const t = index / 31;
      return { horizontal: t, vertical: 2 * t + 1 };
    });

    const fit = fitParametricSketch(points, { relativeErrorTolerance: 0.02 });
    expect(fit).not.toBeNull();
    expect(fit!.degree).toBeLessThanOrEqual(2);
    expect(fit!.maxError).toBeLessThan(0.5);
  });

  it("returns null for very short strokes", () => {
    expect(fitParametricSketch([{ horizontal: 0, vertical: 0 }])).toBeNull();
  });
});

describe("formatPolynomialExpression", () => {
  it("formats a simple quadratic", () => {
    const expr = formatPolynomialExpression([1, -2, 3], "t");
    expect(expr).toContain("t^2");
    expect(expr).toMatch(/1/);
  });
});
