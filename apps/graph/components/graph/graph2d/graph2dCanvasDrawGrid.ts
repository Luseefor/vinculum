import { buildGridSeries } from "@/components/viewport/Grid2D";
import {
  GRID_EDGE_OVERSCAN_LINES,
  MAX_GRID_LABEL_COUNT,
  MAX_GRID_LINE_COUNT,
  MIN_GRID_SPACING_UNITS,
  GRID_TARGET_SPACING_PX
} from "./graph2dCanvasConstants";
import { formatNumber } from "./graph2dCanvasFormat";
import { alignToPixel } from "./graph2dCanvasMath";
import type { ViewportTransform } from "./graph2dCanvasProbes";
import type { DrawContext } from "./graph2dCanvasTypes";

export type Graph2dGridPalette = {
  gridMinor: string;
  gridMajor: string;
  axis: string;
  axisLabel: string;
};

export function drawGraph2dGrid(
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number },
  colors: Graph2dGridPalette
): void {
  const { ctx, width, height, centerX, centerY, scale } = dc;
  const minX = centerX - width / (2 * scale);
  const maxX = centerX + width / (2 * scale);
  const minY = centerY - height / (2 * scale);
  const maxY = centerY + height / (2 * scale);

  const safeRawSpacing = Math.max(MIN_GRID_SPACING_UNITS, GRID_TARGET_SPACING_PX / scale);
  const magnitude = Math.pow(10, Math.floor(Math.log10(safeRawSpacing)));
  const normalized = safeRawSpacing / magnitude;

  let gridSpacing: number;
  if (normalized < 2) {
    gridSpacing = magnitude;
  } else if (normalized < 5) {
    gridSpacing = 2 * magnitude;
  } else {
    gridSpacing = 5 * magnitude;
  }

  const minorSpacing = Math.max(MIN_GRID_SPACING_UNITS, gridSpacing / 5);
  const minorOverscan = minorSpacing * GRID_EDGE_OVERSCAN_LINES;
  const majorOverscan = gridSpacing * GRID_EDGE_OVERSCAN_LINES;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  ctx.strokeStyle = colors.gridMinor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  const minorXSeries = buildGridSeries(minX - minorOverscan, maxX + minorOverscan, minorSpacing, MAX_GRID_LINE_COUNT);
  if (minorXSeries) {
    for (let i = 0; i < minorXSeries.count; i += 1) {
      const x = minorXSeries.start + minorXSeries.step * i;
      const screen = mathToScreen(x, 0, dc);
      const alignedX = alignToPixel(screen.x);
      ctx.moveTo(alignedX, 0);
      ctx.lineTo(alignedX, height);
    }
  }
  const minorYSeries = buildGridSeries(minY - minorOverscan, maxY + minorOverscan, minorSpacing, MAX_GRID_LINE_COUNT);
  if (minorYSeries) {
    for (let i = 0; i < minorYSeries.count; i += 1) {
      const y = minorYSeries.start + minorYSeries.step * i;
      const screen = mathToScreen(0, y, dc);
      const alignedY = alignToPixel(screen.y);
      ctx.moveTo(0, alignedY);
      ctx.lineTo(width, alignedY);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = colors.gridMajor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.78;
  ctx.beginPath();
  const majorXSeries = buildGridSeries(minX - majorOverscan, maxX + majorOverscan, gridSpacing, MAX_GRID_LINE_COUNT);
  if (majorXSeries) {
    for (let i = 0; i < majorXSeries.count; i += 1) {
      const x = majorXSeries.start + majorXSeries.step * i;
      const screen = mathToScreen(x, 0, dc);
      const alignedX = alignToPixel(screen.x);
      ctx.moveTo(alignedX, 0);
      ctx.lineTo(alignedX, height);
    }
  }
  const majorYSeries = buildGridSeries(minY - majorOverscan, maxY + majorOverscan, gridSpacing, MAX_GRID_LINE_COUNT);
  if (majorYSeries) {
    for (let i = 0; i < majorYSeries.count; i += 1) {
      const y = majorYSeries.start + majorYSeries.step * i;
      const screen = mathToScreen(0, y, dc);
      const alignedY = alignToPixel(screen.y);
      ctx.moveTo(0, alignedY);
      ctx.lineTo(width, alignedY);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  const originScreen = mathToScreen(0, 0, dc);
  const alignedOriginY = alignToPixel(originScreen.y);
  const alignedOriginX = alignToPixel(originScreen.x);
  if (originScreen.y >= 0 && originScreen.y <= height) {
    ctx.moveTo(0, alignedOriginY);
    ctx.lineTo(width, alignedOriginY);
  }
  if (originScreen.x >= 0 && originScreen.x <= width) {
    ctx.moveTo(alignedOriginX, 0);
    ctx.lineTo(alignedOriginX, height);
  }
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = colors.axisLabel;
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const xLabelSeries = buildGridSeries(minX, maxX, gridSpacing, MAX_GRID_LABEL_COUNT);
  if (xLabelSeries) {
    for (let i = 0; i < xLabelSeries.count; i += 1) {
      const x = xLabelSeries.start + xLabelSeries.step * i;
      if (Math.abs(x) < 1e-10) {
        continue;
      }
      const screen = mathToScreen(x, 0, dc);
      const labelY = Math.min(Math.max(originScreen.y + 4, 4), height - 14);
      ctx.fillText(formatNumber(x), screen.x, labelY);
    }
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yLabelSeries = buildGridSeries(minY, maxY, gridSpacing, MAX_GRID_LABEL_COUNT);
  if (yLabelSeries) {
    for (let i = 0; i < yLabelSeries.count; i += 1) {
      const y = yLabelSeries.start + yLabelSeries.step * i;
      if (Math.abs(y) < 1e-10) {
        continue;
      }
      const screen = mathToScreen(0, y, dc);
      const labelX = Math.min(Math.max(originScreen.x - 4, 30), width - 4);
      ctx.fillText(formatNumber(y), labelX, screen.y);
    }
  }
}
