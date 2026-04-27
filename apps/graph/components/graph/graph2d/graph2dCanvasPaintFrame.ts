import type { Axis2DPair, GraphProbePin } from "@/types/graphUi";
import { drawProbeLabel, drawScreenCrosshair } from "./graph2dCanvasDrawPrimitives";
import { formatProbeCoord } from "./graph2dCanvasFormat";
import { drawGraph2dGrid } from "./graph2dCanvasDrawGrid";
import { drawRenderableGraph2d } from "./graph2dCanvasDrawRenderableGraph";
import { alignToPixel } from "./graph2dCanvasMath";
import { graph2dMathToScreen } from "./graph2dCanvasTransforms";
import { projectWorldTo2dPair } from "./graph2dCanvasProbes";
import type { AxisPairSpec, DrawContext, Graph2dPaintPalette, MousePosition, RenderableGraph } from "./graph2dCanvasTypes";

export type PaintGraph2dCanvasFrameArgs = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  palette: Graph2dPaintPalette;
  viewport: { centerX: number; centerY: number; scale: number };
  renderableGraphs: RenderableGraph[];
  canvas2dTool: "pan" | "probe" | "draw";
  mousePos: MousePosition | null;
  isQuadTop: boolean;
  probePins: GraphProbePin[];
  pairForCanvas: Axis2DPair;
  axisPair: AxisPairSpec;
  sketchDraft: { horizontal: number; vertical: number }[] | null;
};

export function paintGraph2dCanvasFrame(args: PaintGraph2dCanvasFrameArgs): void {
  const {
    canvas,
    container,
    palette,
    viewport,
    renderableGraphs,
    canvas2dTool,
    mousePos,
    isQuadTop,
    probePins,
    pairForCanvas,
    axisPair,
    sketchDraft
  } = args;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const dc: DrawContext = {
    ctx,
    width: rect.width,
    height: rect.height,
    centerX: viewport.centerX,
    centerY: viewport.centerY,
    scale: viewport.scale
  };

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, dc.width, dc.height);
  drawGraph2dGrid(dc, graph2dMathToScreen, {
    gridMinor: palette.gridMinor,
    gridMajor: palette.gridMajor,
    axis: palette.axis,
    axisLabel: palette.axisLabel
  });
  const vignette = ctx.createRadialGradient(
    dc.width / 2,
    dc.height / 2,
    Math.min(dc.width, dc.height) * 0.25,
    dc.width / 2,
    dc.height / 2,
    Math.max(dc.width, dc.height) * 0.72
  );
  vignette.addColorStop(0, "rgba(2, 6, 23, 0)");
  vignette.addColorStop(1, "rgba(2, 6, 23, 0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, dc.width, dc.height);

  for (const graph of renderableGraphs) {
    drawRenderableGraph2d(graph, dc, graph2dMathToScreen);
  }

  if (canvas2dTool === "probe" && mousePos && !isQuadTop) {
    const cursorScreen = graph2dMathToScreen(mousePos.math.horizontal, mousePos.math.vertical, dc);
    drawScreenCrosshair(ctx, dc.width, dc.height, cursorScreen.x, cursorScreen.y, palette.probe, 1, [5, 5]);
  }

  if (!isQuadTop) {
    for (const pin of probePins) {
      const math = projectWorldTo2dPair(pin.world, pairForCanvas);
      const pinnedScreen = graph2dMathToScreen(math.horizontal, math.vertical, dc);
      drawScreenCrosshair(ctx, dc.width, dc.height, pinnedScreen.x, pinnedScreen.y, pin.color, 2, []);

      ctx.save();
      ctx.fillStyle = pin.color;
      ctx.beginPath();
      ctx.arc(alignToPixel(pinnedScreen.x), alignToPixel(pinnedScreen.y), 3.5, 0, Math.PI * 2);
      ctx.fill();

      const label = `${axisPair.horizontalLabel}: ${formatProbeCoord(math.horizontal)} · ${axisPair.verticalLabel}: ${formatProbeCoord(math.vertical)}`;
      drawProbeLabel(ctx, pinnedScreen.x, pinnedScreen.y - 14, label);
      ctx.restore();
    }
  }

  if (sketchDraft && sketchDraft.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dc.width, dc.height);
    ctx.clip();
    ctx.strokeStyle = palette.sketch;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < sketchDraft.length; i += 1) {
      const p = sketchDraft[i];
      const s = graph2dMathToScreen(p.horizontal, p.vertical, dc);
      if (i === 0) {
        ctx.moveTo(s.x, s.y);
      } else {
        ctx.lineTo(s.x, s.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}
