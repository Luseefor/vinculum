import { describe, expect, it } from "vitest";
import {
  integrateSimpson1D,
  integrateSimpson2D,
  isQuadratureQuality,
  normalizeSimpsonCount
} from "@/lib/math/simpsonQuadrature";

describe("Simpson 1D weights and polynomials (S25 PART 35)", () => {
  it("integrates constants through cubics exactly", () => {
    expect(integrateSimpson1D(() => 1, 0, 1, 64).value).toBeCloseTo(1, 12);
    expect(integrateSimpson1D((x) => x, 0, 1, 64).value).toBeCloseTo(1 / 2, 12);
    expect(integrateSimpson1D((x) => x * x, 0, 1, 64).value).toBeCloseTo(1 / 3, 12);
    expect(integrateSimpson1D((x) => x * x * x, 0, 1, 64).value).toBeCloseTo(1 / 4, 12);
  });

  it("rejects odd, non-positive, unbounded, and non-finite counts", () => {
    expect(normalizeSimpsonCount(63, 512)).toBeNull();
    expect(normalizeSimpsonCount(0, 512)).toBeNull();
    expect(normalizeSimpsonCount(-4, 512)).toBeNull();
    expect(normalizeSimpsonCount(513, 512)).toBeNull();
    expect(normalizeSimpsonCount(Number.NaN, 512)).toBeNull();
    expect(integrateSimpson1D(() => 1, 0, 1, 63).status).toBe("non-finite");
    expect(isQuadratureQuality("medium")).toBe(true);
    expect(isQuadratureQuality("ultra")).toBe(false);
  });

  it("fails closed on non-finite nodes without skipping", () => {
    const throwing = integrateSimpson1D(
      (x) => {
        if (x === 0.5) {
          throw new Error("pole");
        }
        return 1 / (x - 0.5);
      },
      0,
      1,
      64
    );
    expect(throwing.status).toBe("non-finite");
    expect(integrateSimpson1D(() => Number.NaN, 0, 1, 64).status).toBe("non-finite");
    expect(integrateSimpson1D(() => Number.POSITIVE_INFINITY, 0, 1, 64).status).toBe("non-finite");
    // 1/x across 0 is an improper integral: unavailable, never a number.
    expect(integrateSimpson1D((x) => 1 / x, -1, 1, 64).status).toBe("non-finite");
  });

  it("counts evaluations exactly once per node", () => {
    const result = integrateSimpson1D((x) => x, 0, 1, 64);
    expect(result.status).toBe("ok");
    expect(result.evaluations).toBe(65);
  });
});

describe("Simpson 2D tensor weights (S25 PART 35)", () => {
  it("integrates constants and low-degree polynomials", () => {
    expect(integrateSimpson2D(() => 1, 0, 1, 0, 1, 32).value).toBeCloseTo(1, 12);
    expect(integrateSimpson2D((u, v) => u + v, 0, 1, 0, 1, 32).value).toBeCloseTo(1, 10);
    expect(integrateSimpson2D((u, v) => u * u + v * v, 0, 1, 0, 1, 32).value).toBeCloseTo(2 / 3, 10);
    expect(integrateSimpson2D((u, v) => u * u * v * v, 0, 1, 0, 1, 32).value).toBeCloseTo(1 / 9, 10);
  });

  it("fails closed on non-finite nodes", () => {
    expect(integrateSimpson2D(() => Number.NaN, 0, 1, 0, 1, 32).status).toBe("non-finite");
    expect(integrateSimpson2D((u) => 1 / u, -1, 1, -1, 1, 32).status).toBe("non-finite");
  });

  it("evaluates each grid node exactly once", () => {
    const result = integrateSimpson2D((u, v) => u + v, 0, 1, 0, 1, 32);
    expect(result.evaluations).toBe(33 * 33);
  });
});

describe("convergence estimate (S25 PART 36)", () => {
  it("is ~0 for exactly-integrated polynomials", () => {
    const result = integrateSimpson1D((x) => x * x, 0, 1, 64);
    expect(result.estimatedError).toBeLessThan(1e-12);
  });

  it("tightens with quality on sin(x)", () => {
    const expected = 2;
    const low = integrateSimpson1D((x) => Math.sin(x), 0, Math.PI, 64);
    const medium = integrateSimpson1D((x) => Math.sin(x), 0, Math.PI, 128);
    const high = integrateSimpson1D((x) => Math.sin(x), 0, Math.PI, 256);
    expect(Math.abs(medium.value - expected)).toBeLessThanOrEqual(Math.abs(low.value - expected) + 1e-12);
    expect(Math.abs(high.value - expected)).toBeLessThanOrEqual(Math.abs(medium.value - expected) + 1e-12);
    expect(high.estimatedError).toBeLessThanOrEqual(medium.estimatedError + 1e-15);
    expect(high.value).toBeCloseTo(expected, 8);
  });
});
