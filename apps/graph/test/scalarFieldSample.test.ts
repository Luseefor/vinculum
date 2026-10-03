import { describe, expect, it } from "vitest";
import {
  clampScalarGridResolution,
  MAX_SCALAR_GRID_RESOLUTION,
  sampleScalarGrid,
  scalarGridMemoryBytes
} from "@/lib/math/scalarFieldSample";

const DOMAIN = { uMin: -5, uMax: 5, vMin: -5, vMax: 5 };

describe("sampleScalarGrid (S23 PART 1)", () => {
  it("samples (resolution+1)^2 nodes with endpoints and exact stats", () => {
    const grid = sampleScalarGrid((u, v) => u * u + v * v, DOMAIN, 128);
    expect(grid.width).toBe(129);
    expect(grid.height).toBe(129);
    expect(grid.totalSamples).toBe(129 * 129);
    expect(grid.validCount).toBe(129 * 129);
    expect(grid.min).toBeCloseTo(0, 10);
    expect(grid.max).toBeCloseTo(50, 10);
    // Corner node is exact evaluator output.
    expect(grid.values[0]).toBeCloseTo(50, 10);
  });

  it("leaves singular samples invalid without smearing", () => {
    const grid = sampleScalarGrid(
      (u) => {
        if (u === 0) {
          throw new Error("pole");
        }
        return 1 / u;
      },
      { uMin: -2, uMax: 2, vMin: -1, vMax: 1 },
      8
    );
    // Center column (u=0) invalid, neighbors finite.
    expect(grid.validCount).toBeLessThan(grid.totalSamples);
    expect(grid.validCount).toBeGreaterThan(0);
    for (let j = 0; j < grid.height; j += 1) {
      expect(grid.valid[j * grid.width + 4]).toBe(0);
      expect(grid.valid[j * grid.width + 3]).toBe(1);
      expect(grid.valid[j * grid.width + 5]).toBe(1);
    }
  });

  it("reports empty when nothing is finite", () => {
    const grid = sampleScalarGrid(() => Number.NaN, DOMAIN, 16);
    expect(grid.validCount).toBe(0);
    expect(grid.min).toBe(0);
    expect(grid.max).toBe(0);
  });

  it("clamps resolution and documents memory", () => {
    expect(clampScalarGridResolution(128, MAX_SCALAR_GRID_RESOLUTION)).toBe(128);
    expect(clampScalarGridResolution(9999, MAX_SCALAR_GRID_RESOLUTION)).toBe(MAX_SCALAR_GRID_RESOLUTION);
    expect(clampScalarGridResolution(Number.NaN, MAX_SCALAR_GRID_RESOLUTION)).toBe(128);
    // PART 39: 257^2 Float32 ~= 264 KB + ~66 KB validity.
    const memory = scalarGridMemoryBytes(256);
    expect(memory.values).toBe(257 * 257 * 4);
    expect(memory.validity).toBe(257 * 257);
  });
});
