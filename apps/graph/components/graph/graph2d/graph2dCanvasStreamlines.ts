import { projectMathToPair2D, type MathAxisPair } from "@/lib/math/coordinates";
import type { StreamlineResultBody } from "@/lib/compute/streamlineResults";
import { drawScreenArrowheads, type ScreenArrowTip } from "./graph2dCanvasVectorField";
import type { AxisPairSpec, DrawContext } from "./graph2dCanvasTypes";
import type { ViewportTransform } from "./graph2dCanvasProbes";

// S24 2D streamline rendering: connected polylines from cached worker
// results plus one midpoint direction head per curve. Reads the result
// cache; never samples, never requests — pan/zoom only redraws (0 jobs).
// Points integrate in the field's canonical (x, y) mathematics and map
// through the pair projection (never a vector transform — these are
// positions, PART 13). Heads follow +F along increasing polyline index.
//
// Pair semantics (deliberate, mirrors S20 glyphs): the curves are the
// orthographic projection of the z=0-embedded trajectories, so under
// xz/yz pairs they collapse toward the horizontal axis exactly like
// projected glyph arrows do. The default xy pair shows true geometry.
// (Scalar heat instead gates on pair match because a scalar function of
// (x, y) has no meaning on other planes without fixing a variable.)
// StreamlineAttachment lives canonically in graph2dCanvasTypes.

function pairKey(axisPair: AxisPairSpec): MathAxisPair {
  const key = `${axisPair.horizontal}${axisPair.vertical}`;
  if (key === "xz" || key === "yz") {
    return key;
  }
  return "xy";
}

export function drawStreamlines2D(
  result: Extract<StreamlineResultBody, { status: "ok" }>,
  color: string,
  axisPair: AxisPairSpec,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  const { ctx } = dc;
  const pair = pairKey(axisPair);
  const project = (x: number, y: number) => {
    const projected = projectMathToPair2D({ x, y, z: 0 }, pair);
    return mathToScreen(projected.horizontal, projected.vertical, dc);
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dc.width, dc.height);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // One connected path per streamline (a single path would join separate
  // curves with spurious connectors).
  for (let c = 0; c < result.streamlineCount; c += 1) {
    const start = result.offsets[c] as number;
    const end = result.offsets[c + 1] as number;
    ctx.beginPath();
    for (let p = start; p < end; p += 1) {
      const screen = project(result.points[p * 2] as number, result.points[p * 2 + 1] as number);
      if (p === start) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    }
    ctx.stroke();
  }
  // One midpoint head per curve: orientation along +F (increasing index).
  const tips: ScreenArrowTip[] = [];
  for (let c = 0; c < result.streamlineCount; c += 1) {
    const start = result.offsets[c] as number;
    const end = result.offsets[c + 1] as number;
    if (end - start < 2) {
      continue;
    }
    const middle = start + Math.floor((end - start) / 2);
    const before = project(
      result.points[(middle - 1) * 2] as number,
      result.points[(middle - 1) * 2 + 1] as number
    );
    const after = project(
      result.points[middle * 2] as number,
      result.points[middle * 2 + 1] as number
    );
    const shaftPx = Math.hypot(after.x - before.x, after.y - before.y);
    if (!(shaftPx > 2)) {
      continue;
    }
    tips.push({
      x: after.x,
      y: after.y,
      angle: Math.atan2(after.y - before.y, after.x - before.x),
      shaftPx
    });
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.8;
  drawScreenArrowheads(tips, ctx);
  ctx.restore();
}
