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

  if (graph.analysisPoints) {
    ctx.fillStyle = graph.color;
    for (const point of graph.analysisPoints) {
      const screen = mathToScreen(point.x, point.y, dc);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.strokeStyle = graph.color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (graph.meshXY) {
    const { points, indices, wireframe } = graph.meshXY;
    for (let i = 0; i < indices.length; i += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const index = indices[i + corner] * 2;
        const point = mathToScreen(points[index], points[index + 1], dc);
        if (corner === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
    }
    ctx.fillStyle = graph.color;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    if (wireframe) {
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

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

  if (graph.hatchDomain || graph.coplanarSurface) {
    drawHatchedDomain(graph.hatchDomain ?? { hMin: dc.centerX - width / (2 * scale), hMax: dc.centerX + width / (2 * scale), vMin: dc.centerY - height / (2 * scale), vMax: dc.centerY + height / (2 * scale) }, ctx, dc, graph.color);
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
