import { drawGraph2dExplicitFunctionCurve } from "./graph2dCanvasDrawRenderableGraphExplicitCurve";
import { drawGraph2dVerticalHorizontalLinesAndPolyline } from "./graph2dCanvasDrawRenderableGraphLinesPolyline";
import { drawLinearTransformLayer } from "./graph2dCanvasDrawLinearTransform";
import { drawVectorFieldArrows } from "./graph2dCanvasVectorField";
import { drawHatchedDomain, drawImplicitContour } from "./graph2dCanvasImplicitDraw";
import type { ViewportTransform } from "./graph2dCanvasProbes";
import type { DrawContext, RenderableGraph } from "./graph2dCanvasTypes";

export function drawRenderableGraph2d(
  graph: RenderableGraph,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  const { ctx, width, height, scale, centerX } = dc;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.strokeStyle = graph.color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (drawGraph2dVerticalHorizontalLinesAndPolyline(graph, dc, ctx, width, height, mathToScreen)) {
    ctx.restore();
    return;
  }

  if (graph.vectorField) {
    drawVectorFieldArrows(graph.vectorField, graph.color, dc, mathToScreen);
    ctx.restore();
    return;
  }

  // S28: 2D linear-transformation basis + unit square (XY only, resolved
  // at build). Drawn in the per-graph pass: above the reference grid,
  // below selection/probe overlays (PART 62 — no layer reorder).
  if (graph.linearTransform) {
    drawLinearTransformLayer(graph.linearTransform, graph.color, dc, mathToScreen);
    ctx.restore();
    return;
  }

  if (graph.implicitEvaluate) {
    drawImplicitContour(graph.implicitEvaluate, ctx, dc, width, height);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (graph.hatchDomain) {
    drawHatchedDomain(graph.hatchDomain, ctx, dc, graph.color);
    ctx.restore();
    return;
  }

  if (!graph.evaluate) {
    ctx.restore();
    return;
  }

  drawGraph2dExplicitFunctionCurve(graph, dc, ctx, width, height, scale, centerX, mathToScreen);
  ctx.restore();
}
