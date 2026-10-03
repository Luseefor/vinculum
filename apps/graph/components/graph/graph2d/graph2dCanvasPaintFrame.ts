import type { Axis2DPair, GraphProbePin, ScalarVizConfig, StreamlineVizConfig } from "@/types/graphUi";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";
import type { ScalarVizResultEntry } from "@/lib/compute/scalarVizResults";
import type { StreamlineResultEntry } from "@/lib/compute/streamlineResults";
import { drawProbeLabel, drawScreenCrosshair } from "./graph2dCanvasDrawPrimitives";
import { formatProbeCoord } from "./graph2dCanvasFormat";
import { drawGraph2dGrid } from "./graph2dCanvasDrawGrid";
import { drawRenderableGraph2d } from "./graph2dCanvasDrawRenderableGraph";
import { alignToPixel } from "./graph2dCanvasMath";
import { graph2dMathToScreen } from "./graph2dCanvasTransforms";
import { projectWorldTo2dPair } from "./graph2dCanvasProbes";
import {
  buildScalarGradientArrows,
  drawScalarContours,
  drawScalarGradientField,
  drawScalarHeatLayer
} from "./graph2dCanvasScalarViz";
import { drawStreamlines2D } from "./graph2dCanvasStreamlines";
import type { AxisPairSpec, DrawContext, Graph2dPaintPalette, MousePosition, RenderableGraph } from "./graph2dCanvasTypes";

export type PaintGraph2dCanvasFrameArgs = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  palette: Graph2dPaintPalette;
  theme: "light" | "dark";
  viewport: { centerX: number; centerY: number; scale: number };
  renderableGraphs: RenderableGraph[];
  scalarResults: Record<string, ScalarVizResultEntry>;
  scalarConfigs: Record<string, ScalarVizConfig>;
  streamlineResults: Record<string, StreamlineResultEntry>;
  streamlineConfigs: Record<string, StreamlineVizConfig>;
  canvas2dTool: "pan" | "probe" | "draw" | "measureDistance" | "measureAngle" | "addPin";
  mousePos: MousePosition | null;
  isQuadTop: boolean;
  probePins: GraphProbePin[];
  measurements: SceneMeasurement[];
  selectedMeasurementId: string | null;
  pairForCanvas: Axis2DPair;
  axisPair: AxisPairSpec;
  sketchDraft: { horizontal: number; vertical: number }[] | null;
};

export function paintGraph2dCanvasFrame(args: PaintGraph2dCanvasFrameArgs): void {
  const {
    canvas,
    container,
    palette,
    theme,
    viewport,
    renderableGraphs,
    scalarResults,
    scalarConfigs,
    streamlineResults,
    streamlineConfigs,
    canvas2dTool,
    mousePos,
    isQuadTop,
    probePins,
    measurements,
    selectedMeasurementId,
    pairForCanvas,
    axisPair,
    sketchDraft
  } = args;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = container.getBoundingClientRect();
  const pixelWidth = Math.floor(rect.width * dpr);
  const pixelHeight = Math.floor(rect.height * dpr);
  // Resizing clears the backing buffer and resets context state. Hover and
  // viewport redraws should reuse it unless its actual dimensions changed.
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  if (canvas.style.width !== `${rect.width}px`) canvas.style.width = `${rect.width}px`;
  if (canvas.style.height !== `${rect.height}px`) canvas.style.height = `${rect.height}px`;
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
  // S23 heat pass: cached bitmaps blitted under the grid (never above
  // curves). Pure redraw from cached results — zero resampling.
  drawScalarHeatPass(renderableGraphs, scalarResults, scalarConfigs, theme, dc);
  drawGraph2dGrid(dc, graph2dMathToScreen, {
    gridMinor: palette.gridMinor,
    gridMajor: palette.gridMajor,
    axis: palette.axis,
    axisLabel: palette.axisLabel
  });

  for (const graph of renderableGraphs) {
    drawRenderableGraph2d(graph, dc, graph2dMathToScreen);
    // S23 derived overlays paint with their source: contours and gradient
    // glyphs above the source curve, below probes/measurements.
    drawScalarOverlaysForGraph(graph, scalarResults, scalarConfigs, theme, dc);
    // S24 streamlines paint with their source field, above glyphs.
    drawStreamlineOverlaysForGraph(graph, streamlineResults, streamlineConfigs, axisPair, dc);
  }

  if (
    (canvas2dTool === "probe" || canvas2dTool === "measureDistance" || canvas2dTool === "measureAngle" || canvas2dTool === "addPin") &&
    mousePos &&
    !isQuadTop
  ) {
    const cursorScreen = graph2dMathToScreen(mousePos.math.horizontal, mousePos.math.vertical, dc);
    drawScreenCrosshair(ctx, dc.width, dc.height, cursorScreen.x, cursorScreen.y, palette.probe, 1.25, [4, 4]);
  }

  if (!isQuadTop) {
    drawMeasurementOverlays2d(ctx, dc, measurements, pairForCanvas, selectedMeasurementId);

    for (const pin of probePins) {
      const math = projectWorldTo2dPair(pin.world, pairForCanvas);
      const pinnedScreen = graph2dMathToScreen(math.horizontal, math.vertical, dc);
      drawScreenCrosshair(ctx, dc.width, dc.height, pinnedScreen.x, pinnedScreen.y, pin.color, 1.5, []);

      ctx.save();
      ctx.fillStyle = pin.color;
      ctx.beginPath();
      ctx.arc(alignToPixel(pinnedScreen.x), alignToPixel(pinnedScreen.y), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
      ctx.lineWidth = 1;
      ctx.stroke();

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

function drawScalarHeatPass(
  renderableGraphs: RenderableGraph[],
  scalarResults: Record<string, ScalarVizResultEntry>,
  scalarConfigs: Record<string, ScalarVizConfig>,
  theme: "light" | "dark",
  dc: DrawContext
): void {
  const attachments: {
    attachment: { sourceId: string; domain: { uMin: number; uMax: number; vMin: number; vMax: number } };
    signature: string;
    result: Extract<ScalarVizResultEntry["result"], { status: "ok" }>;
  }[] = [];
  for (const graph of renderableGraphs) {
    if (!graph.scalarField) {
      continue;
    }
    const config = scalarConfigs[graph.scalarField.sourceId];
    const entry = scalarResults[`scalar:${graph.scalarField.sourceId}`];
    if (!config?.showHeatmap || !entry || entry.result.status !== "ok") {
      continue;
    }
    attachments.push({ attachment: graph.scalarField, signature: entry.signature, result: entry.result });
  }
  if (attachments.length === 0) {
    return;
  }
  drawScalarHeatLayer(attachments, theme, dc, graph2dMathToScreen);
}

function drawScalarOverlaysForGraph(
  graph: RenderableGraph,
  scalarResults: Record<string, ScalarVizResultEntry>,
  scalarConfigs: Record<string, ScalarVizConfig>,
  theme: "light" | "dark",
  dc: DrawContext
): void {
  if (!graph.scalarField) {
    return;
  }
  const config = scalarConfigs[graph.scalarField.sourceId];
  const entry = scalarResults[`scalar:${graph.scalarField.sourceId}`];
  if (!config || !entry || entry.result.status !== "ok") {
    return;
  }
  const result = entry.result;
  if (config.showContours && result.contourStatus === "ok" && result.contourSegmentCount > 0) {
    drawScalarContours(result.contourSegments, result.contourSegmentCount, dc, graph2dMathToScreen, theme);
  }
  if (config.showGradient && result.gradientStatus === "ok") {
    const arrows = buildScalarGradientArrows(
      result,
      graph.scalarField.domain,
      Math.floor(config.gradientDensity),
      config.gradientScale,
      config.gradientNormalize
    );
    if (arrows) {
      drawScalarGradientField(arrows, graph.color, dc, graph2dMathToScreen);
    }
  }
}

function drawStreamlineOverlaysForGraph(
  graph: RenderableGraph,
  streamlineResults: Record<string, StreamlineResultEntry>,
  streamlineConfigs: Record<string, StreamlineVizConfig>,
  axisPair: AxisPairSpec,
  dc: DrawContext
): void {
  if (!graph.streamlines) {
    return;
  }
  const config = streamlineConfigs[graph.streamlines.sourceId];
  const entry = streamlineResults[`streamline:${graph.streamlines.sourceId}`];
  if (!config?.enabled || !entry || entry.result.status !== "ok") {
    return;
  }
  drawStreamlines2D(entry.result, graph.color, axisPair, dc, graph2dMathToScreen);
}

function drawMeasurementOverlays2d(
  ctx: CanvasRenderingContext2D,
  dc: DrawContext,
  measurements: SceneMeasurement[],
  pairForCanvas: Axis2DPair,
  selectedMeasurementId: string | null
): void {
  for (const measurement of measurements) {
    if (measurement.kind === "pin") {
      continue;
    }
    if (measurement.kind === "distance") {
      const a = projectWorldTo2dPair(measurement.points[0], pairForCanvas);
      const b = projectWorldTo2dPair(measurement.points[1], pairForCanvas);
      const sa = graph2dMathToScreen(a.horizontal, a.vertical, dc);
      const sb = graph2dMathToScreen(b.horizontal, b.vertical, dc);
      const isSelected = measurement.id === selectedMeasurementId;
      ctx.save();
      ctx.strokeStyle = isSelected ? "#f97316" : "rgba(251,146,60,0.9)";
      ctx.lineWidth = isSelected ? 2.5 : 1.75;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      drawProbeLabel(
        ctx,
        (sa.x + sb.x) / 2,
        (sa.y + sb.y) / 2 - 6,
        `${Math.hypot(measurement.points[0].x - measurement.points[1].x, measurement.points[0].y - measurement.points[1].y, measurement.points[0].z - measurement.points[1].z).toFixed(4)} u`,
        dc.width,
        dc.height
      );
      ctx.restore();
      continue;
    }

    const [p0, pv, p2] = measurement.points;
    const a = projectWorldTo2dPair(p0, pairForCanvas);
    const v = projectWorldTo2dPair(pv, pairForCanvas);
    const c = projectWorldTo2dPair(p2, pairForCanvas);
    const sa = graph2dMathToScreen(a.horizontal, a.vertical, dc);
    const sv = graph2dMathToScreen(v.horizontal, v.vertical, dc);
    const sc = graph2dMathToScreen(c.horizontal, c.vertical, dc);
    const isSelected = measurement.id === selectedMeasurementId;

    ctx.save();
    ctx.strokeStyle = isSelected ? "#f97316" : "rgba(251,146,60,0.9)";
    ctx.lineWidth = isSelected ? 2.25 : 1.5;
    ctx.beginPath();
    ctx.moveTo(sv.x, sv.y);
    ctx.lineTo(sa.x, sa.y);
    ctx.moveTo(sv.x, sv.y);
    ctx.lineTo(sc.x, sc.y);
    ctx.stroke();

    const angleA = Math.atan2(sa.y - sv.y, sa.x - sv.x);
    const angleC = Math.atan2(sc.y - sv.y, sc.x - sv.x);
    const arcRadius = Math.max(14, Math.min(30, Math.min(Math.hypot(sa.x - sv.x, sa.y - sv.y), Math.hypot(sc.x - sv.x, sc.y - sv.y)) * 0.35));
    ctx.beginPath();
    ctx.arc(sv.x, sv.y, arcRadius, angleA, angleC, false);
    ctx.stroke();

    const ux = p0.x - pv.x;
    const uy = p0.y - pv.y;
    const uz = p0.z - pv.z;
    const vx = p2.x - pv.x;
    const vy = p2.y - pv.y;
    const vz = p2.z - pv.z;
    const uMag = Math.hypot(ux, uy, uz);
    const vMag = Math.hypot(vx, vy, vz);
    const degrees =
      uMag === 0 || vMag === 0 ? NaN : (Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy + uz * vz) / (uMag * vMag)))) * 180) / Math.PI;
    const midAngle = (angleA + angleC) / 2;
    drawProbeLabel(
      ctx,
      sv.x + Math.cos(midAngle) * (arcRadius + 12),
      sv.y + Math.sin(midAngle) * (arcRadius + 8),
      Number.isFinite(degrees) ? `${degrees.toFixed(2)} deg` : "Invalid angle",
      dc.width,
      dc.height
    );
    ctx.restore();
  }
}

export function buildMeasurement2dRenderData(measurements: SceneMeasurement[]): {
  distanceCount: number;
  angleCount: number;
  pinCount: number;
} {
  return measurements.reduce(
    (acc, measurement) => {
      if (measurement.kind === "distance") acc.distanceCount += 1;
      else if (measurement.kind === "angle") acc.angleCount += 1;
      else acc.pinCount += 1;
      return acc;
    },
    { distanceCount: 0, angleCount: 0, pinCount: 0 }
  );
}
