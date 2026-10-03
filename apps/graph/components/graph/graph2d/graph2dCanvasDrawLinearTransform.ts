// S28 2D linear-transformation layer (PART 13): reference unit square +
// basis (subtle) beneath the transformed parallelogram + basis arrows
// (object color, stronger), with optional real eigendirection segments.
// Rank collapse draws naturally (parallelogram → line → point); zero
// basis vectors skip arrowheads. Immediate Canvas only, O(1) state.

import { drawScreenArrowheads, type ScreenArrowTip } from "./graph2dCanvasVectorField";
import type { DrawContext, LinearTransformLayer } from "./graph2dCanvasTypes";
import type { ViewportTransform } from "./graph2dCanvasProbes";

type MathToScreen = (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number };

const REFERENCE_STYLE = "rgba(100, 116, 139, 0.55)";
const EIGEN_STYLE = "#f59e0b";

function tracePath(
  ctx: CanvasRenderingContext2D,
  corners: ReadonlyArray<readonly [number, number]>,
  mathToScreen: MathToScreen,
  dc: DrawContext
): void {
  ctx.beginPath();
  corners.forEach(([x, y], index) => {
    const screen = mathToScreen(x, y, dc);
    if (index === 0) {
      ctx.moveTo(screen.x, screen.y);
    } else {
      ctx.lineTo(screen.x, screen.y);
    }
  });
  ctx.closePath();
}

function arrowAlong(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  mathToScreen: MathToScreen,
  dc: DrawContext,
  tips: ScreenArrowTip[]
): void {
  const base = mathToScreen(fromX, fromY, dc);
  const tip = mathToScreen(toX, toY, dc);
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(tip.x, tip.y);
  const shaftPx = Math.hypot(tip.x - base.x, tip.y - base.y);
  // Zero-length basis vectors (rank collapse) draw as points below;
  // never a degenerate arrowhead.
  if (shaftPx > 2) {
    tips.push({ x: tip.x, y: tip.y, angle: Math.atan2(tip.y - base.y, tip.x - base.x), shaftPx });
  }
}

export function drawLinearTransformLayer(
  layer: LinearTransformLayer,
  color: string,
  dc: DrawContext,
  mathToScreen: MathToScreen
): void {
  const { ctx } = dc;
  const [a11, a12, a21, a22] = layer.matrix;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Reference unit square + basis, deliberately quiet (PART 13/62).
  ctx.strokeStyle = REFERENCE_STYLE;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.8;
  tracePath(ctx, [[0, 0], [1, 0], [1, 1], [0, 1]], mathToScreen, dc);
  ctx.stroke();
  const referenceTips: ScreenArrowTip[] = [];
  ctx.beginPath();
  arrowAlong(ctx, 0, 0, 1, 0, mathToScreen, dc, referenceTips);
  arrowAlong(ctx, 0, 0, 0, 1, mathToScreen, dc, referenceTips);
  ctx.stroke();
  drawScreenArrowheads(referenceTips, ctx);
  ctx.globalAlpha = 1;

  // Transformed parallelogram + basis in the canonical object color.
  const corners: Array<[number, number]> = [
    [0, 0],
    [a11, a21],
    [a11 + a12, a21 + a22],
    [a12, a22]
  ];
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  tracePath(ctx, corners, mathToScreen, dc);
  ctx.stroke();
  // Collapsed corners (rank < 2) still mark the image point.
  const collapsed = corners.every(([x, y]) => x === 0 && y === 0);
  if (collapsed) {
    const origin = mathToScreen(0, 0, dc);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tips: ScreenArrowTip[] = [];
  ctx.beginPath();
  arrowAlong(ctx, 0, 0, a11, a21, mathToScreen, dc, tips);
  arrowAlong(ctx, 0, 0, a12, a22, mathToScreen, dc, tips);
  ctx.stroke();
  drawScreenArrowheads(tips, ctx);

  // Real eigendirections as finite symmetric segments through the
  // origin (PART 25): half-length tracks the longest transformed basis
  // (min 1), so lines stay proportionate without camera hooks.
  if (layer.showEigen && layer.eigenDirections.length > 0) {
    const longest = Math.max(
      1,
      Math.hypot(a11, a21),
      Math.hypot(a12, a22)
    );
    ctx.strokeStyle = EIGEN_STYLE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const [dx, dy] of layer.eigenDirections) {
      const from = mathToScreen(-dx * longest, -dy * longest, dc);
      const to = mathToScreen(dx * longest, dy * longest, dc);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
