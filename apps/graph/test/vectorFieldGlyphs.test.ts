import { describe, expect, it } from "vitest";
import {
  computeGlyphLength,
  VECTOR_GLYPH_MAX_FRACTION,
  VECTOR_GLYPH_MIN_FRACTION,
  vectorFieldCellSize
} from "@/lib/math/vectorFieldGlyphs";

describe("computeGlyphLength (S20 glyph policy)", () => {
  it("scales relative magnitude against the reference, capped at one cell", () => {
    expect(computeGlyphLength(2, 4, 1, 1, false)).toBeCloseTo(0.5, 12);
    // User scale above 1 cannot push past the cell cap.
    expect(computeGlyphLength(4, 4, 1, 3, false)).toBe(VECTOR_GLYPH_MAX_FRACTION);
    expect(computeGlyphLength(4, 4, 2, 3, false)).toBe(2);
  });

  it("floors tiny nonzero magnitudes at the minimum fraction", () => {
    expect(computeGlyphLength(1e-9, 4, 1, 1, false)).toBe(VECTOR_GLYPH_MIN_FRACTION);
  });

  it("normalize mode equalizes all nonzero lengths and ignores the reference", () => {
    expect(computeGlyphLength(1, 2, 1, 1, true)).toBe(
      computeGlyphLength(2, 2, 1, 1, true)
    );
    expect(computeGlyphLength(1, 0, 1, 1, true)).toBe(1);
    expect(computeGlyphLength(1, 2, 1, 0.5, true)).toBeCloseTo(0.5, 12);
    // Normalize scale above 1 still caps at the cell.
    expect(computeGlyphLength(1, 2, 1, 3, true)).toBe(1);
  });

  it("returns 0 for zero/invalid magnitudes, degenerate cells, and dead references", () => {
    expect(computeGlyphLength(0, 4, 1, 1, false)).toBe(0);
    expect(computeGlyphLength(-1, 4, 1, 1, false)).toBe(0);
    expect(computeGlyphLength(Number.NaN, 4, 1, 1, false)).toBe(0);
    expect(computeGlyphLength(2, 4, 0, 1, false)).toBe(0);
    expect(computeGlyphLength(2, 0, 1, 1, false)).toBe(0);
    expect(computeGlyphLength(2, 4, 1, 0, false)).toBe(0);
  });
});

describe("vectorFieldCellSize", () => {
  it("uses the tightest axis spacing with endpoints included", () => {
    expect(
      vectorFieldCellSize({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 11, "2d")
    ).toBe(1);
    // Anisotropic: y extent 2 over 11 points -> 0.2 governs.
    expect(
      vectorFieldCellSize({ xMin: -5, xMax: 5, yMin: -1, yMax: 1 }, 11, "2d")
    ).toBeCloseTo(0.2, 12);
    // 3D includes the z extent.
    expect(
      vectorFieldCellSize(
        { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -1, zMax: 1 },
        9,
        "3d"
      )
    ).toBeCloseTo(0.25, 12);
  });

  it("collapses safely on degenerate input", () => {
    expect(vectorFieldCellSize({ xMin: 2, xMax: 2, yMin: 2, yMax: 2 }, 4, "2d")).toBe(0);
    expect(vectorFieldCellSize({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 1, "2d")).toBe(0);
  });
});
