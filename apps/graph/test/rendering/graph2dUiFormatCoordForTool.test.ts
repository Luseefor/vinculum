import { describe, expect, it } from "vitest";
import { formatCoord, formatProbeCoord } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { formatGraph2dCoordForTool } from "@/components/graph/graph2d/graph2dUiFormatCoordForTool";

describe("formatGraph2dCoordForTool", () => {
  it("matches formatProbeCoord for probe tool", () => {
    const n = 1.23456789;
    expect(formatGraph2dCoordForTool(n, "probe")).toBe(formatProbeCoord(n));
  });

  it("matches formatCoord for pan and draw tools", () => {
    const n = 1.23456789;
    expect(formatGraph2dCoordForTool(n, "pan")).toBe(formatCoord(n));
    expect(formatGraph2dCoordForTool(n, "draw")).toBe(formatCoord(n));
  });
});
