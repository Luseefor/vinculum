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

  if (graph.polylineHV && graph.polylineHV.points.length >= 4) {
    // S5: parametric branches obey canonical sampler connectivity exactly.
    // No screen-space jump or offscreen rules here: zoom/pan must never change
    // mathematical branch topology. (Explicit/implicit paths keep their own
    // heuristics in their dedicated draw helpers.)
    const pts = graph.polylineHV.points;
    const connected = graph.polylineHV.connectedSegments;
    const pointCount = pts.length / 2;
    let branchOpen = false;

    for (let j = 0; j < pointCount; j += 1) {
      const h = pts[j * 2];
      const v = pts[j * 2 + 1];
      if (!Number.isFinite(h) || !Number.isFinite(v)) {
        branchOpen = false;
        continue;
      }

      const screen = mathToScreen(h, v, dc);
      if (!branchOpen || j === 0 || connected[j - 1] !== 1) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
      branchOpen = true;
    }

    ctx.stroke();
    return true;
  }

  return false;
}
