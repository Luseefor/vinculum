import {
  CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
  CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR,
  CURVE_VERTICAL_BREAK_MIN_PX,
  CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR
} from "./graph2dCanvasConstants";
import { alignToPixel } from "./graph2dCanvasMath";
import type { ViewportTransform } from "./graph2dCanvasProbes";
import type { DrawContext, RenderableGraph } from "./graph2dCanvasTypes";

export function drawGraph2dVerticalHorizontalLinesAndPolyline(
  graph: RenderableGraph,
  dc: DrawContext,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): boolean {
  const verticalBreakPx = Math.max(CURVE_VERTICAL_BREAK_MIN_PX, height * CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR);
  const verticalPaddingPx = Math.max(
    CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
    height * CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR
  );

  if (graph.verticalLineValue !== null) {
    const screen = mathToScreen(graph.verticalLineValue, 0, dc);
    const alignedX = alignToPixel(screen.x);
    ctx.moveTo(alignedX, 0);
    ctx.lineTo(alignedX, height);
    ctx.stroke();
    return true;
  }

  if (graph.horizontalLineValue !== null) {
    const screen = mathToScreen(0, graph.horizontalLineValue, dc);
    const alignedY = alignToPixel(screen.y);
    ctx.moveTo(0, alignedY);
    ctx.lineTo(width, alignedY);
    ctx.stroke();
    return true;
  }

  if (graph.polylineHV && graph.polylineHV.length >= 4) {
    const pts = graph.polylineHV;
    let isFirst = true;
    let lastScreenY: number | null = null;

    for (let i = 0; i < pts.length; i += 2) {
      const h = pts[i];
      const v = pts[i + 1];
      if (!Number.isFinite(h) || !Number.isFinite(v)) {
        isFirst = true;
        lastScreenY = null;
        continue;
      }

      const screen = mathToScreen(h, v, dc);
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
    return true;
  }

  return false;
}
