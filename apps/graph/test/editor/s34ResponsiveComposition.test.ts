// S34 responsive composition model: centralized breakpoints (PART 1/2).

import { describe, expect, it } from "vitest";
import {
  COMPACT_MAX_HEIGHT,
  COMPACT_MAX_WIDTH,
  WIDE_MIN_WIDTH,
  compositionForViewport,
  compositionForWidth
} from "@/lib/responsive/composition";
import {
  CANVAS_CLEAN_CLICK_PX,
  cleanClickThresholdForPointerType,
  isCleanClick
} from "@/lib/interaction/canvasInteractionModel";

describe("compositionForWidth", () => {
  it("uses compact <720, medium <1100, wide above", () => {
    expect(COMPACT_MAX_WIDTH).toBe(720);
    expect(WIDE_MIN_WIDTH).toBe(1100);
    expect(compositionForWidth(390)).toBe("compact");
    expect(compositionForWidth(719)).toBe("compact");
    expect(compositionForWidth(720)).toBe("medium");
    expect(compositionForWidth(1024)).toBe("medium");
    expect(compositionForWidth(1099)).toBe("medium");
    expect(compositionForWidth(1100)).toBe("wide");
    expect(compositionForWidth(1440)).toBe("wide");
  });

  it("falls back to wide for invalid widths", () => {
    expect(compositionForWidth(Number.NaN)).toBe("wide");
    expect(compositionForWidth(-10)).toBe("wide");
  });
});

describe("compositionForViewport", () => {
  it("treats short landscapes as compact (PART 11/69)", () => {
    expect(COMPACT_MAX_HEIGHT).toBe(500);
    expect(compositionForViewport(844, 390)).toBe("compact");
    expect(compositionForViewport(1024, 768)).toBe("medium");
    expect(compositionForViewport(768, 1024)).toBe("medium");
    expect(compositionForViewport(390, 844)).toBe("compact");
    expect(compositionForViewport(1440, 900)).toBe("wide");
  });
});

describe("cleanClickThresholdForPointerType", () => {
  it("keeps mouse precision while tolerating touch drift (PART 50)", () => {
    expect(CANVAS_CLEAN_CLICK_PX).toBe(6);
    expect(cleanClickThresholdForPointerType("mouse")).toBe(6);
    expect(cleanClickThresholdForPointerType(undefined)).toBe(6);
    expect(cleanClickThresholdForPointerType(null)).toBe(6);
    expect(cleanClickThresholdForPointerType("pen")).toBe(8);
    expect(cleanClickThresholdForPointerType("touch")).toBe(12);
  });

  it("isCleanClick threads pointer type through", () => {
    // 10px: click for touch, drag for mouse.
    expect(isCleanClick(0, 0, 10, 0, "touch")).toBe(true);
    expect(isCleanClick(0, 0, 10, 0, "mouse")).toBe(false);
    expect(isCleanClick(0, 0, 10, 0, "pen")).toBe(false);
    expect(isCleanClick(0, 0, 5, 0, "mouse")).toBe(true);
    expect(isCleanClick(0, 0, 0, 0)).toBe(true);
  });
});
