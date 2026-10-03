import { describe, expect, it } from "vitest";
import { sampleScalarGrid } from "@/lib/math/scalarFieldSample";
import {
  computeContourLevels,
  extractContours,
  MAX_CONTOUR_SEGMENTS
} from "@/lib/math/marchingSquares";

function gridFor(fn: (u: number, v: number) => number, range = 5, resolution = 64) {
  const domain = { uMin: -range, uMax: range, vMin: -range, vMax: range };
  const grid = sampleScalarGrid(fn, domain, resolution);
  return { grid, domain };
}

// Max |f(point) - level| over segments, normalized by grid spacing.
function maxResidual(
  segments: Float32Array,
  count: number,
  fn: (u: number, v: number) => number,
  level: number,
  spacing: number
): number {
  let worst = 0;
  for (let s = 0; s < count; s += 1) {
    for (let e = 0; e < 2; e += 1) {
      const x = segments[s * 4 + e * 2] as number;
      const y = segments[s * 4 + e * 2 + 1] as number;
      const residual = Math.abs(fn(x, y) - level);
      if (residual > worst) {
        worst = residual;
      }
    }
  }
  return worst / Math.max(1e-12, spacing);
}

describe("computeContourLevels (S23 PART 3)", () => {
  it("spaces levels evenly and forces a zero level for signed ranges", () => {
    const levels = computeContourLevels(0, 50, 6);
    expect(levels).toHaveLength(6);
    expect(levels[0]).toBeCloseTo(0, 12);
    expect(levels[5]).toBeCloseTo(50, 12);
    const signed = computeContourLevels(-50, 50, 8);
    expect(Array.from(signed).some((level) => level === 0)).toBe(true);
    expect(new Set(Array.from(signed)).size).toBe(8);
  });

  it("clamps counts and handles constant ranges", () => {
    expect(computeContourLevels(0, 10, 0)).toHaveLength(1);
    expect(computeContourLevels(0, 10, 999)).toHaveLength(16);
    expect(Array.from(computeContourLevels(5, 5, 8))).toEqual([5]);
  });
});

describe("extractContours (S23 PART 10)", () => {
  it("traces a closed near-circle for f=x^2+y^2 at level 1", () => {
    const fn = (u: number, v: number) => u * u + v * v;
    const { grid, domain } = gridFor(fn, 2, 96);
    const extracted = extractContours(grid, domain, new Float32Array([1]));
    expect(extracted.status).toBe("ok");
    expect(extracted.segmentCount).toBeGreaterThan(40);
    // Residual within a few grid spacings (linear interpolation error).
    expect(maxResidual(extracted.segments, extracted.segmentCount, fn, 1, 4 / 96)).toBeLessThan(3);
    // Near-circle: every endpoint sits at radius ~= 1.
    let worstRadius = 0;
    for (let s = 0; s < extracted.segmentCount * 4; s += 2) {
      const x = extracted.segments[s] as number;
      const y = extracted.segments[s + 1] as number;
      const radius = Math.abs(Math.sqrt(x * x + y * y) - 1);
      if (radius > worstRadius) {
        worstRadius = radius;
      }
    }
    expect(worstRadius).toBeLessThan(0.05);
  });

  it("finds saddle zero-contour branches near y=+-x", () => {
    const fn = (u: number, v: number) => u * u - v * v;
    const { grid, domain } = gridFor(fn, 3, 96);
    const extracted = extractContours(grid, domain, new Float32Array([0]));
    expect(extracted.status).toBe("ok");
    expect(extracted.segmentCount).toBeGreaterThan(30);
    // Every endpoint lies near one of the diagonals.
    for (let s = 0; s < extracted.segmentCount * 4; s += 2) {
      const x = Math.abs(extracted.segments[s] as number);
      const y = Math.abs(extracted.segments[s + 1] as number);
      expect(Math.abs(x - y)).toBeLessThan(0.15);
    }
  });

  it("renders straight contours for a linear field", () => {
    const fn = (u: number, v: number) => u + 2 * v;
    const { grid, domain } = gridFor(fn, 4, 48);
    const extracted = extractContours(grid, domain, new Float32Array([0]));
    expect(extracted.status).toBe("ok");
    // All segments collinear: direction of (2,-1) up to sign.
    for (let s = 0; s < extracted.segmentCount; s += 1) {
      const dx = (extracted.segments[s * 4 + 2] as number) - (extracted.segments[s * 4] as number);
      const dy = (extracted.segments[s * 4 + 3] as number) - (extracted.segments[s * 4 + 1] as number);
      const cross = Math.abs(dx * -1 - dy * 2) / Math.max(1e-12, Math.hypot(dx, dy));
      expect(cross).toBeLessThan(1e-9);
    }
  });

  it("never bridges the 1/x singularity", () => {
    const fn = (u: number) => 1 / u;
    const domain = { uMin: -2, uMax: 2, vMin: -2, vMax: 2 };
    const grid = sampleScalarGrid((u, v) => fn(u) + 0 * v, domain, 64);
    // Level 1 traces the interior vertical line x=1 (level 0.5 would sit
    // on the domain boundary and yield nothing).
    const extracted = extractContours(grid, domain, new Float32Array([1]));
    expect(extracted.status).toBe("ok");
    // No segment endpoint inside the invalid column band around x=0.
    const du = 4 / 64;
    for (let s = 0; s < extracted.segmentCount * 4; s += 2) {
      expect(Math.abs(extracted.segments[s] as number)).toBeGreaterThan(du / 2);
    }
  });

  it("resolves ambiguous cells deterministically", () => {
    // Direct synthetic case-5 cell: a,c inside; b,d outside; center
    // average 0 >= 0 joins through the middle: (B-R) + (T-L).
    const domain = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
    const synthetic = {
      values: new Float32Array([1, -1, -1, 1]),
      valid: new Uint8Array([1, 1, 1, 1]),
      width: 2,
      height: 2,
      min: -1,
      max: 1,
      validCount: 4,
      totalSamples: 4
    };
    const first = extractContours(synthetic, domain, new Float32Array([0]));
    const second = extractContours(synthetic, domain, new Float32Array([0]));
    expect(first.status).toBe("ok");
    expect(first.segmentCount).toBe(2);
    expect(Array.from(first.segments)).toEqual(Array.from(second.segments));
  });

  it("reports degenerate for a constant field at the requested level", () => {
    const { grid, domain } = gridFor(() => 5, 2, 16);
    const extracted = extractContours(grid, domain, new Float32Array([5]));
    expect(extracted.status).toBe("degenerate");
    expect(extracted.segmentCount).toBe(0);
    const other = extractContours(grid, domain, new Float32Array([6]));
    expect(other.status).toBe("empty");
  });

  it("aborts cleanly past the segment budget", () => {
    // High-frequency field at high resolution overflows the budget.
    const fn = (u: number, v: number) => Math.sin(u * 40) * Math.cos(v * 40);
    const { grid, domain } = gridFor(fn, 5, 256);
    const levels = computeContourLevels(grid.min, grid.max, 16);
    const extracted = extractContours(grid, domain, levels);
    expect(["ok", "budget-exceeded"]).toContain(extracted.status);
    if (extracted.status === "budget-exceeded") {
      expect(extracted.segmentCount).toBe(0);
      expect(extracted.segments).toHaveLength(0);
    } else {
      expect(extracted.segmentCount).toBeLessThanOrEqual(MAX_CONTOUR_SEGMENTS);
    }
  });
});
