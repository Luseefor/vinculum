import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEWPORT_SCALE,
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  sanitizeViewportCenter,
  sanitizeViewportPatch,
  sanitizeViewportScale
} from "@/lib/graph/viewport";
import type { Viewport2D } from "@/types/graphUi";

describe("viewport sanitization", () => {
  it("keeps finite center values for effectively infinite panning", () => {
    expect(sanitizeViewportCenter(0)).toBe(0);
    expect(sanitizeViewportCenter(1e20)).toBe(1e20);
    expect(sanitizeViewportCenter(-1e20)).toBe(-1e20);
  });

  it("falls back for non-finite center values", () => {
    expect(sanitizeViewportCenter(Number.POSITIVE_INFINITY, 123)).toBe(123);
    expect(sanitizeViewportCenter(Number.NaN, -4)).toBe(-4);
  });

  it("clamps scale into valid range", () => {
    expect(sanitizeViewportScale(0)).toBe(MIN_VIEWPORT_SCALE);
    expect(sanitizeViewportScale(MIN_VIEWPORT_SCALE / 10)).toBe(MIN_VIEWPORT_SCALE);
    expect(sanitizeViewportScale(MAX_VIEWPORT_SCALE * 10)).toBe(MAX_VIEWPORT_SCALE);
    expect(sanitizeViewportScale(100)).toBe(100);
  });

  it("falls back for non-finite scale values", () => {
    expect(sanitizeViewportScale(Number.NaN, 7)).toBe(7);
    expect(sanitizeViewportScale(Number.POSITIVE_INFINITY, 7)).toBe(7);
  });

  it("sanitizes partial viewport updates", () => {
    const current: Viewport2D = {
      centerX: 10,
      centerY: -20,
      scale: DEFAULT_VIEWPORT_SCALE
    };

    const next = sanitizeViewportPatch(current, {
      centerX: Number.POSITIVE_INFINITY,
      centerY: 1e30,
      scale: 0
    });

    expect(next.centerX).toBe(10);
    expect(next.centerY).toBe(1e30);
    expect(next.scale).toBe(MIN_VIEWPORT_SCALE);
  });
});
