import { describe, it, expect } from "vitest";
import { formatCoord, formatProbeCoord, formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";

describe("graph2dCanvasFormat", () => {
  describe("formatCoord", () => {
    it("formats zero as 0", () => {
      expect(formatCoord(0)).toBe("0");
      expect(formatCoord(1e-11)).toBe("0");
    });

    it("formats small numbers with exponential notation", () => {
      expect(formatCoord(0.001)).toBe("1.0e-3");
      expect(formatCoord(0.0001)).toBe("1.0e-4");
    });

    it("formats large numbers with exponential notation", () => {
      expect(formatCoord(1000)).toBe("1.0e+3");
      expect(formatCoord(10000)).toBe("1.0e+4");
    });

    it("formats normal numbers to 2 decimal places", () => {
      expect(formatCoord(3.14159)).toBe("3.14");
      expect(formatCoord(-2.5)).toBe("-2.5");
      expect(formatCoord(100)).toBe("100");
    });
  });

  describe("formatProbeCoord", () => {
    it("handles NaN and Infinity", () => {
      expect(formatProbeCoord(NaN)).toBe("NaN");
      expect(formatProbeCoord(Infinity)).toBe("NaN");
      expect(formatProbeCoord(-Infinity)).toBe("NaN");
    });

    it("formats zero as 0", () => {
      expect(formatProbeCoord(0)).toBe("0");
    });

    it("formats small numbers with exponential notation", () => {
      expect(formatProbeCoord(0.001)).toBe("1.00e-3");
    });

    it("formats large numbers with exponential notation", () => {
      expect(formatProbeCoord(1000)).toBe("1.00e+3");
      expect(formatProbeCoord(10000)).toBe("1.00e+4");
    });

    it("formats normal numbers to 3 decimal places", () => {
      expect(formatProbeCoord(3.14159)).toBe("3.142");
      expect(formatProbeCoord(-2.5)).toBe("-2.5");
    });
  });

  describe("formatNumber", () => {
    it("formats zero as 0", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("formats small numbers with exponential notation", () => {
      expect(formatNumber(0.0001)).toBe("1.0e-4");
    });

    it("formats large numbers with exponential notation", () => {
      expect(formatNumber(1000)).toBe("1.0e+3");
    });

    it("formats normal numbers with up to 4 decimal places", () => {
      expect(formatNumber(3.14159)).toBe("3.1416");
      expect(formatNumber(100)).toBe("100");
    });
  });
});
