import { describe, expect, it } from "vitest";
import { graph2dMathToScreen, graph2dScreenToMath } from "@/components/graph/graph2d/graph2dCanvasTransforms";

const viewport = { centerX: 0, centerY: 0, scale: 100 };

describe("graph2dScreenToMath / graph2dMathToScreen", () => {
  it("round-trips the viewport center through screen center", () => {
    const w = 400;
    const h = 300;
    const m = graph2dScreenToMath(w / 2, h / 2, w, h, viewport);
    expect(m.horizontal).toBeCloseTo(0);
    expect(m.vertical).toBeCloseTo(0);

    const dc = { width: w, height: h, centerX: viewport.centerX, centerY: viewport.centerY, scale: viewport.scale };
    const s = graph2dMathToScreen(m.horizontal, m.vertical, dc);
    expect(s.x).toBeCloseTo(w / 2);
    expect(s.y).toBeCloseTo(h / 2);
  });

  it("maps a screen offset to math with inverted Y", () => {
    const w = 200;
    const h = 200;
    const m = graph2dScreenToMath(150, 50, w, h, viewport);
    expect(m.horizontal).toBeCloseTo(0.5);
    expect(m.vertical).toBeCloseTo(0.5);
  });

  it("round-trips an arbitrary math point", () => {
    const w = 500;
    const h = 400;
    const math = { horizontal: 2.5, vertical: -1.25 };
    const dc = { width: w, height: h, centerX: viewport.centerX, centerY: viewport.centerY, scale: viewport.scale };
    const screen = graph2dMathToScreen(math.horizontal, math.vertical, dc);
    const back = graph2dScreenToMath(screen.x, screen.y, w, h, viewport);
    expect(back.horizontal).toBeCloseTo(math.horizontal);
    expect(back.vertical).toBeCloseTo(math.vertical);
  });
});
