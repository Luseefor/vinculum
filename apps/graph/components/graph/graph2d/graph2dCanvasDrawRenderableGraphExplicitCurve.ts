import {
  CURVE_EDGE_OVERSCAN_PX,
  CURVE_MAX_SAMPLES,
  CURVE_MIN_SAMPLES,
  CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
  CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR,
  CURVE_VERTICAL_BREAK_MIN_PX,
  CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR
} from "./graph2dCanvasConstants";
import { clamp } from "./graph2dCanvasMath";
import type { ViewportTransform } from "./graph2dCanvasProbes";
import type { DrawContext, RenderableGraph } from "./graph2dCanvasTypes";

export function drawGraph2dExplicitFunctionCurve(
  graph: RenderableGraph,
  dc: DrawContext,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  centerX: number,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  const edgeOverscanUnits = CURVE_EDGE_OVERSCAN_PX / scale;
  const verticalBreakPx = Math.max(CURVE_VERTICAL_BREAK_MIN_PX, height * CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR);
  const verticalPaddingPx = Math.max(
    CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
    height * CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR
  );

  const minHorizontal = centerX - width / (2 * scale) - edgeOverscanUnits;
  const maxHorizontal = centerX + width / (2 * scale) + edgeOverscanUnits;
  const sampleCount = clamp(
    Math.round((width + CURVE_EDGE_OVERSCAN_PX * 2) * 1.15),
    CURVE_MIN_SAMPLES,
    CURVE_MAX_SAMPLES
  );
  const horizontalSpan = maxHorizontal - minHorizontal;

  let isFirst = true;
  let lastScreenY: number | null = null;

  for (let index = 0; index <= sampleCount; index += 1) {
    const horizontal = minHorizontal + horizontalSpan * (index / sampleCount);
    const vertical = graph.evaluate!(horizontal);
    if (vertical === null) {
      isFirst = true;
      lastScreenY = null;
      continue;
    }

    const screen = mathToScreen(horizontal, vertical, dc);
    if (screen.y < -verticalPaddingPx || screen.y > height + verticalPaddingPx) {
      isFirst = true;
      lastScreenY = null;
      continue;
    }

    if (lastScreenY !== null && Math.abs(screen.y - lastScreenY) > verticalBreakPx) {
      isFirst = true;
    }

    if (isFirst) {
      ctx.moveTo(screen.x, screen.y);
      isFirst = false;
    } else {
      ctx.lineTo(screen.x, screen.y);
    }

    lastScreenY = screen.y;
  }

  ctx.stroke();
}
