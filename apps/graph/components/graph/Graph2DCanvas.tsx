"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { compile } from "mathjs";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import {
  fitParametricSketch,
  formatPolynomialExpression,
  type FitParametricSketchResult
} from "@/lib/math/fitParametricSketch";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { buildGridSeries } from "@/components/viewport/Grid2D";
import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";
import type { Axis2DPair } from "@/types/graphUi";
import type { ParametricCurveObject } from "@vinculum/scene/types";

interface Graph2DCanvasProps {
  className?: string;
}

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  scale: number;
}

interface MousePosition {
  screen: { x: number; y: number };
  math: { horizontal: number; vertical: number };
}

interface SketchFitPreview {
  stroke: { horizontal: number; vertical: number }[];
  fit: FitParametricSketchResult;
  horizontalExpr: string;
  verticalExpr: string;
}

type AxisVariable = "x" | "y" | "z";

interface AxisPairSpec {
  horizontal: AxisVariable;
  vertical: AxisVariable;
  horizontalLabel: "X" | "Y" | "Z";
  verticalLabel: "X" | "Y" | "Z";
}

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

interface RenderableGraph {
  id: string;
  color: string;
  verticalLineValue: number | null;
  horizontalLineValue: number | null;
  evaluate: ((horizontalValue: number) => number | null) | null;
  polylineHV: Float64Array | null;
}

const GRID_TARGET_SPACING_PX = 60;
const MIN_GRID_SPACING_UNITS = 1e-8;
const MAX_GRID_LINE_COUNT = 2000;
const MAX_GRID_LABEL_COUNT = 320;
const CURVE_MIN_SAMPLES = 384;
const CURVE_MAX_SAMPLES = 8192;
/** When consecutive samples jump farther than this (screen px), start a new stroke segment (asymptotes / branches). */
const CURVE_VERTICAL_BREAK_MIN_PX = 56;
const CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR = 0.9;
const CURVE_EDGE_OVERSCAN_PX = 96;
/**
 * Vertical off-screen padding (px): samples farther than this above/below the viewport are treated as discontinuities
 * (used together with height * CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR).
 */
const CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX = 1200;
const CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR = 2;
const GRID_EDGE_OVERSCAN_LINES = 2;
const ZOOM_IN_FACTOR = 1.12;
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR;
const CURSOR_TOOLTIP_OFFSET_PX = 12;
const CURSOR_TOOLTIP_WIDTH_PX = 140;
const VIEWPORT_BADGE_HEIGHT_PX = 28;
const SKETCH_SAMPLE_MIN_SCREEN_PX = 2.25;
const SKETCH_MIN_POINTS_TO_FIT = 4;

export function Graph2DCanvas({ className = "" }: Graph2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedTheme = useResolvedTheme();

  const objects = useGraphStore((state) => state.scene.objects);
  const viewport = useGraphStore((state) => state.ui.viewport2d);
  const viewportFrame = useGraphStore((state) => state.ui.viewport2dFrame);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);
  const probePinnedMath = useGraphStore((state) => state.ui.probePinnedMath);
  const updateViewport2D = useGraphStore((state) => state.updateViewport2D);
  const setViewport2DFrame = useGraphStore((state) => state.setViewport2DFrame);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const setProbePinnedMath = useGraphStore((state) => state.setProbePinnedMath);
  const addSketchedParametricFromStroke = useGraphStore((state) => state.addSketchedParametricFromStroke);
  const sketchAutoCreate = useGraphStore((state) => state.ui.sketchAutoCreate);
  const axisPair = useMemo(() => getAxisPairSpec(axis2dPair), [axis2dPair]);

  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const isSketching = useRef(false);
  const lastSketchScreen = useRef<{ x: number; y: number } | null>(null);
  const sketchAccumRef = useRef<{ horizontal: number; vertical: number }[]>([]);
  const [mousePos, setMousePos] = useState<MousePosition | null>(null);
  const [sketchDraft, setSketchDraft] = useState<{ horizontal: number; vertical: number }[] | null>(null);
  const [sketchFitPreview, setSketchFitPreview] = useState<SketchFitPreview | null>(null);

  const palette = useMemo(() => {
    const tokens = getGraphThemeTokens(resolvedTheme);
    return {
      background: tokens.surfaceCanvas,
      gridMinor: tokens.gridMinor,
      gridMajor: tokens.gridMajor,
      axis: tokens.axisLine,
      axisLabel: tokens.axisLabel,
      probe: resolvedTheme === "dark" ? "#f472b6" : "#db2777",
      sketch: resolvedTheme === "dark" ? "#38bdf8" : "#0284c7"
    };
  }, [resolvedTheme]);

  const screenToMath = useCallback(
    (screenX: number, screenY: number, width: number, height: number) => {
      const horizontal = (screenX - width / 2) / viewport.scale + viewport.centerX;
      const vertical = -(screenY - height / 2) / viewport.scale + viewport.centerY;
      return { horizontal, vertical };
    },
    [viewport.centerX, viewport.centerY, viewport.scale]
  );

  const mathToScreen = useCallback((mathX: number, mathY: number, dc: DrawContext) => {
    const screenX = (mathX - dc.centerX) * dc.scale + dc.width / 2;
    const screenY = -(mathY - dc.centerY) * dc.scale + dc.height / 2;
    return { x: screenX, y: screenY };
  }, []);

  const snapMathPoint = useCallback(
    (point: { horizontal: number; vertical: number }) => {
      if (!snapEnabled || !Number.isFinite(snapStep) || snapStep <= 0) {
        return point;
      }
      return {
        horizontal: snapToStep(point.horizontal, snapStep),
        vertical: snapToStep(point.vertical, snapStep)
      };
    },
    [snapEnabled, snapStep]
  );

  const drawGrid = useCallback(
    (dc: DrawContext) => {
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
      const colors = palette;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();

      ctx.strokeStyle = colors.gridMinor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const minorXSeries = buildGridSeries(
        minX - minorOverscan,
        maxX + minorOverscan,
        minorSpacing,
        MAX_GRID_LINE_COUNT
      );
      if (minorXSeries) {
        for (let i = 0; i < minorXSeries.count; i += 1) {
          const x = minorXSeries.start + minorXSeries.step * i;
          const screen = mathToScreen(x, 0, dc);
          const alignedX = alignToPixel(screen.x);
          ctx.moveTo(alignedX, 0);
          ctx.lineTo(alignedX, height);
        }
      }
      const minorYSeries = buildGridSeries(
        minY - minorOverscan,
        maxY + minorOverscan,
        minorSpacing,
        MAX_GRID_LINE_COUNT
      );
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
      ctx.beginPath();
      const majorXSeries = buildGridSeries(
        minX - majorOverscan,
        maxX + majorOverscan,
        gridSpacing,
        MAX_GRID_LINE_COUNT
      );
      if (majorXSeries) {
        for (let i = 0; i < majorXSeries.count; i += 1) {
          const x = majorXSeries.start + majorXSeries.step * i;
          const screen = mathToScreen(x, 0, dc);
          const alignedX = alignToPixel(screen.x);
          ctx.moveTo(alignedX, 0);
          ctx.lineTo(alignedX, height);
        }
      }
      const majorYSeries = buildGridSeries(
        minY - majorOverscan,
        maxY + majorOverscan,
        gridSpacing,
        MAX_GRID_LINE_COUNT
      );
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
    },
    [mathToScreen, palette]
  );

  const renderableGraphs = useMemo<RenderableGraph[]>(() => {
    const graphs: RenderableGraph[] = [];

    for (const obj of objects) {
      if (!obj.visible) {
        continue;
      }

      if (obj.kind === "parametricCurve") {
        const polylineHV = buildParametricPolylineHV(obj, axisPair.horizontal, axisPair.vertical);
        if (polylineHV) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: null,
            horizontalLineValue: null,
            evaluate: null,
            polylineHV
          });
        }
        continue;
      }

      let expr = "";
      if (obj.kind === "surface") {
        expr = obj.equation;
      } else if (obj.kind === "plane") {
        expr = obj.equation;
      } else {
        continue;
      }

      const trimmed = expr.trim();
      if (!trimmed) {
        continue;
      }

      const horizontal = escapeRegExp(axisPair.horizontal);
      const vertical = escapeRegExp(axisPair.vertical);

      const verticalLineMatch = trimmed.match(new RegExp(`^${horizontal}\\s*=\\s*([\\d.eE+-]+)$`, "i"));
      if (verticalLineMatch) {
        const value = Number(verticalLineMatch[1]);
        if (Number.isFinite(value)) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: value,
            horizontalLineValue: null,
            evaluate: null,
            polylineHV: null
          });
        }
        continue;
      }

      const horizontalLineMatch = trimmed.match(new RegExp(`^${vertical}\\s*=\\s*([\\d.eE+-]+)$`, "i"));
      if (horizontalLineMatch) {
        const value = Number(horizontalLineMatch[1]);
        if (Number.isFinite(value)) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: null,
            horizontalLineValue: value,
            evaluate: null,
            polylineHV: null
          });
        }
        continue;
      }

      const directValue = Number(trimmed);
      if (Number.isFinite(directValue)) {
        graphs.push({
          id: obj.id,
          color: obj.color,
          verticalLineValue: null,
          horizontalLineValue: directValue,
          evaluate: null,
          polylineHV: null
        });
        continue;
      }

      const dependentPattern = new RegExp(`^${vertical}\\s*=\\s*`, "i");
      const cleanExpr = trimmed.replace(dependentPattern, "").trim();
      const compiled = tryCompileMathExpression(cleanExpr);
      if (!compiled) {
        continue;
      }

      graphs.push({
        id: obj.id,
        color: obj.color,
        verticalLineValue: null,
        horizontalLineValue: null,
        polylineHV: null,
        evaluate: (horizontalValue: number) => {
          try {
            const scope: Record<string, number> = {
              x: 0,
              y: 0,
              z: 0,
              t: horizontalValue,
              pi: Math.PI,
              e: Math.E
            };
            scope[axisPair.horizontal] = horizontalValue;
            const result = compiled.evaluate(scope);
            const numeric = typeof result === "number" ? result : Number(result);
            return Number.isFinite(numeric) ? numeric : null;
          } catch {
            return null;
          }
        }
      });
    }

    return graphs;
  }, [axisPair.horizontal, axisPair.vertical, objects]);

  const drawGraph = useCallback(
    (graph: RenderableGraph, dc: DrawContext) => {
      const { ctx, width, height, scale, centerX } = dc;
      const edgeOverscanUnits = CURVE_EDGE_OVERSCAN_PX / scale;
      const verticalBreakPx = Math.max(
        CURVE_VERTICAL_BREAK_MIN_PX,
        height * CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR
      );
      const verticalPaddingPx = Math.max(
        CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
        height * CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR
      );

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.strokeStyle = graph.color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      if (graph.verticalLineValue !== null) {
        const screen = mathToScreen(graph.verticalLineValue, 0, dc);
        const alignedX = alignToPixel(screen.x);
        ctx.moveTo(alignedX, 0);
        ctx.lineTo(alignedX, height);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (graph.horizontalLineValue !== null) {
        const screen = mathToScreen(0, graph.horizontalLineValue, dc);
        const alignedY = alignToPixel(screen.y);
        ctx.moveTo(0, alignedY);
        ctx.lineTo(width, alignedY);
        ctx.stroke();
        ctx.restore();
        return;
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
        ctx.restore();
        return;
      }

      if (!graph.evaluate) {
        ctx.restore();
        return;
      }

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
        const vertical = graph.evaluate(horizontal);
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
      ctx.restore();
    },
    [mathToScreen]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

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
    drawGrid(dc);

    for (const graph of renderableGraphs) {
      drawGraph(graph, dc);
    }

    if (canvas2dTool === "probe" && mousePos) {
      const cursorScreen = mathToScreen(mousePos.math.horizontal, mousePos.math.vertical, dc);
      drawScreenCrosshair(ctx, dc.width, dc.height, cursorScreen.x, cursorScreen.y, palette.probe, 1, [5, 5]);
    }

    if (probePinnedMath) {
      const pinnedScreen = mathToScreen(probePinnedMath.horizontal, probePinnedMath.vertical, dc);
      drawScreenCrosshair(ctx, dc.width, dc.height, pinnedScreen.x, pinnedScreen.y, palette.probe, 2, []);
      ctx.save();
      ctx.fillStyle = palette.probe;
      ctx.beginPath();
      ctx.arc(alignToPixel(pinnedScreen.x), alignToPixel(pinnedScreen.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
        const s = mathToScreen(p.horizontal, p.vertical, dc);
        if (i === 0) {
          ctx.moveTo(s.x, s.y);
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [
    canvas2dTool,
    drawGraph,
    drawGrid,
    mathToScreen,
    mousePos,
    palette.background,
    palette.probe,
    palette.sketch,
    probePinnedMath,
    renderableGraphs,
    sketchDraft,
    viewport.centerX,
    viewport.centerY,
    viewport.scale
  ]);

  const zoomAtScreenPoint = useCallback(
    (mouseX: number, mouseY: number, factor: number, width: number, height: number) => {
      const mathPos = screenToMath(mouseX, mouseY, width, height);
      const newScale = clamp(viewport.scale * factor, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
      const newCenterX = mathPos.horizontal - (mouseX - width / 2) / newScale;
      const newCenterY = mathPos.vertical + (mouseY - height / 2) / newScale;

      updateViewport2D({
        scale: newScale,
        centerX: newCenterX,
        centerY: newCenterY
      });
    },
    [screenToMath, updateViewport2D, viewport.scale]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      zoomAtScreenPoint(
        mouseX,
        mouseY,
        e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR,
        rect.width,
        rect.height
      );
    },
    [zoomAtScreenPoint]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const rawMath = screenToMath(screenX, screenY, rect.width, rect.height);
      const mathCoords = snapMathPoint(rawMath);

      if (canvas2dTool === "probe") {
        setProbePinnedMath({
          horizontal: mathCoords.horizontal,
          vertical: mathCoords.vertical
        });
        return;
      }

      if (canvas2dTool === "draw") {
        isSketching.current = true;
        lastSketchScreen.current = { x: screenX, y: screenY };
        activePointerId.current = event.pointerId;
        const first = { horizontal: mathCoords.horizontal, vertical: mathCoords.vertical };
        sketchAccumRef.current = [first];
        setSketchDraft([first]);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      isDragging.current = true;
      lastMouse.current = { x: event.clientX, y: event.clientY };
      activePointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canvas2dTool, screenToMath, setProbePinnedMath, snapMathPoint]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const rawMath = screenToMath(screenX, screenY, rect.width, rect.height);
      const snappedMath = snapMathPoint(rawMath);
      const mathCoords =
        snapEnabled && (canvas2dTool === "probe" || canvas2dTool === "draw") ? snappedMath : rawMath;

      setMousePos({
        screen: { x: screenX, y: screenY },
        math: mathCoords
      });

      if (
        canvas2dTool === "draw" &&
        isSketching.current &&
        event.pointerId === activePointerId.current &&
        lastSketchScreen.current
      ) {
        const dx = screenX - lastSketchScreen.current.x;
        const dy = screenY - lastSketchScreen.current.y;
        if (Math.hypot(dx, dy) >= SKETCH_SAMPLE_MIN_SCREEN_PX) {
          lastSketchScreen.current = { x: screenX, y: screenY };
          const point = { horizontal: mathCoords.horizontal, vertical: mathCoords.vertical };
          sketchAccumRef.current = [...sketchAccumRef.current, point];
          setSketchDraft([...sketchAccumRef.current]);
        }
        return;
      }

      if (!isDragging.current || event.pointerId !== activePointerId.current) {
        return;
      }

      const moveDx = event.clientX - lastMouse.current.x;
      const moveDy = event.clientY - lastMouse.current.y;
      lastMouse.current = { x: event.clientX, y: event.clientY };

      updateViewport2D({
        centerX: viewport.centerX - moveDx / viewport.scale,
        centerY: viewport.centerY + moveDy / viewport.scale
      });
    },
    [canvas2dTool, screenToMath, snapEnabled, snapMathPoint, updateViewport2D, viewport.centerX, viewport.centerY, viewport.scale]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== event.pointerId) {
        return;
      }

      if (canvas2dTool === "draw" && isSketching.current) {
        isSketching.current = false;
        lastSketchScreen.current = null;
        activePointerId.current = null;

        const stroke = sketchAccumRef.current;
        sketchAccumRef.current = [];
        setSketchDraft(null);

        if (stroke.length >= SKETCH_MIN_POINTS_TO_FIT) {
          if (sketchAutoCreate) {
            addSketchedParametricFromStroke(stroke);
          } else {
            const fit = fitParametricSketch(stroke);
            if (fit) {
              setSketchFitPreview({
                stroke,
                fit,
                horizontalExpr: formatPolynomialExpression(fit.horizontalCoeffs, "t"),
                verticalExpr: formatPolynomialExpression(fit.verticalCoeffs, "t")
              });
            }
          }
        }

        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer may already be released (e.g. touch cancelled by OS).
        }

        return;
      }

      isDragging.current = false;
      activePointerId.current = null;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer may already be released (e.g. touch cancelled by OS).
      }
    },
    [addSketchedParametricFromStroke, canvas2dTool, sketchAutoCreate]
  );

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    setMousePos(null);
    if (activePointerId.current === event.pointerId) {
      isDragging.current = false;
      activePointerId.current = null;
    }
  }, []);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current === event.pointerId) {
      isDragging.current = false;
      isSketching.current = false;
      lastSketchScreen.current = null;
      activePointerId.current = null;
      sketchAccumRef.current = [];
      setSketchDraft(null);
    }
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (canvas2dTool === "draw") {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      zoomAtScreenPoint(event.clientX - rect.left, event.clientY - rect.top, 1.5, rect.width, rect.height);
    },
    [canvas2dTool, zoomAtScreenPoint]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setViewport2DFrame({ width: rect.width, height: rect.height });
      }
      draw();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw, setViewport2DFrame]);

  useEffect(() => {
    if (canvas2dTool !== "draw") {
      isSketching.current = false;
      lastSketchScreen.current = null;
      sketchAccumRef.current = [];
      setSketchDraft(null);
      setSketchFitPreview(null);
    }
  }, [canvas2dTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setProbePinnedMath(null);
      if (canvas2dTool === "draw") {
        isSketching.current = false;
        lastSketchScreen.current = null;
        sketchAccumRef.current = [];
        setSketchDraft(null);
        setSketchFitPreview(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvas2dTool, setProbePinnedMath]);

  const viewportRange = useMemo(() => {
    const width = viewportFrame.width;
    const height = viewportFrame.height;
    const halfWidthUnits = width / (2 * viewport.scale);
    const halfHeightUnits = height / (2 * viewport.scale);

    return {
      horizontalMin: viewport.centerX - halfWidthUnits,
      horizontalMax: viewport.centerX + halfWidthUnits,
      verticalMin: viewport.centerY - halfHeightUnits,
      verticalMax: viewport.centerY + halfHeightUnits
    };
  }, [viewport.centerX, viewport.centerY, viewport.scale, viewportFrame.height, viewportFrame.width]);

  const canvasCursorClass =
    canvas2dTool === "pan" ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-crosshair touch-none";

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        data-graph2d-canvas="true"
        className={`h-full w-full ${canvasCursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      />

      {mousePos && (
        <div
          className="absolute pointer-events-none rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] shadow-lg"
          style={{
            left: Math.min(
              mousePos.screen.x + CURSOR_TOOLTIP_OFFSET_PX,
              (containerRef.current?.clientWidth || 0) - CURSOR_TOOLTIP_WIDTH_PX
            ),
            top: Math.min(
              mousePos.screen.y + CURSOR_TOOLTIP_OFFSET_PX,
              (containerRef.current?.clientHeight || 0) - VIEWPORT_BADGE_HEIGHT_PX
            )
          }}
        >
          ({axisPair.horizontalLabel}:{" "}
          {(canvas2dTool === "probe" ? formatProbeCoord : formatCoord)(mousePos.math.horizontal)},{" "}
          {axisPair.verticalLabel}: {(canvas2dTool === "probe" ? formatProbeCoord : formatCoord)(mousePos.math.vertical)})
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => updateViewport2D({ scale: viewport.scale * 1.25 })}
          className="h-7 w-7 rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <span className="text-xs font-semibold">+</span>
        </button>
        <button
          type="button"
          onClick={() => updateViewport2D({ scale: viewport.scale * 0.8 })}
          className="h-7 w-7 rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <span className="text-xs font-semibold">−</span>
        </button>
        <button
          type="button"
          onClick={resetViewport2D}
          className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          title="Reset view"
          aria-label="Reset 2D view"
        >
          Reset
        </button>
      </div>

      <div className="absolute bottom-3 left-3 flex max-w-[min(520px,calc(100%-1.5rem))] flex-col gap-1">
        {sketchFitPreview && (
          <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2 font-mono text-[10px] text-[var(--text-secondary)] shadow-lg">
            <p className="mb-1 text-[var(--text-primary)]">Sketch fit preview</p>
            <p>
              {axisPair.horizontalLabel}(t): {sketchFitPreview.horizontalExpr}
            </p>
            <p>
              {axisPair.verticalLabel}(t): {sketchFitPreview.verticalExpr}
            </p>
            <p className="mt-1 text-[var(--text-tertiary)]">
              degree {sketchFitPreview.fit.degree} · max error {formatCoord(sketchFitPreview.fit.maxError)}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-bg)]"
                onClick={() => {
                  addSketchedParametricFromStroke(sketchFitPreview.stroke);
                  setSketchFitPreview(null);
                }}
              >
                Create
              </button>
              <button
                type="button"
                className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]"
                onClick={() => setSketchFitPreview(null)}
              >
                Discard
              </button>
            </div>
          </div>
        )}
        {mousePos && (
          <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-lg">
            <span className="text-[var(--text-tertiary)]">Cursor </span>
            {axisPair.horizontalLabel}: {(canvas2dTool === "probe" ? formatProbeCoord : formatCoord)(mousePos.math.horizontal)}
            {" · "}
            {axisPair.verticalLabel}: {(canvas2dTool === "probe" ? formatProbeCoord : formatCoord)(mousePos.math.vertical)}
          </div>
        )}
        {probePinnedMath && (
          <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-lg">
            <span className="text-[var(--text-tertiary)]">Pinned </span>
            {axisPair.horizontalLabel}: {formatProbeCoord(probePinnedMath.horizontal)} · {axisPair.verticalLabel}:{" "}
            {formatProbeCoord(probePinnedMath.vertical)}
          </div>
        )}
        <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] shadow-lg">
          {axisPair.horizontalLabel}: [{formatCoord(viewportRange.horizontalMin)}, {formatCoord(viewportRange.horizontalMax)}]
          {" · "}
          {axisPair.verticalLabel}: [{formatCoord(viewportRange.verticalMin)}, {formatCoord(viewportRange.verticalMax)}]
        </div>
      </div>
    </div>
  );
}

function drawScreenCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sx: number,
  sy: number,
  color: string,
  lineWidth: number,
  dash: number[]
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  const ax = alignToPixel(sx);
  const ay = alignToPixel(sy);
  ctx.beginPath();
  ctx.moveTo(ax, 0);
  ctx.lineTo(ax, height);
  ctx.moveTo(0, ay);
  ctx.lineTo(width, ay);
  ctx.stroke();
  ctx.restore();
}

function isCompiledMathExpression(value: unknown): value is CompiledMathExpression {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "evaluate" in value && typeof (value as { evaluate?: unknown }).evaluate === "function";
}

function tryCompileMathExpression(expr: string): CompiledMathExpression | null {
  const trimmed = expr.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const node = compile(trimmed);
    return isCompiledMathExpression(node) ? node : null;
  } catch {
    return null;
  }
}

function axisComponentIndex(axis: AxisVariable): 0 | 1 | 2 {
  if (axis === "x") {
    return 0;
  }

  if (axis === "y") {
    return 1;
  }

  return 2;
}

function buildParametricPolylineHV(
  obj: ParametricCurveObject,
  horizontal: AxisVariable,
  vertical: AxisVariable
): Float64Array | null {
  const compiled = compileParametricExpressions(obj.xExpr, obj.yExpr, obj.zExpr);
  if (compiled.error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleCurve(compiled.evaluator, {
      tMin: obj.tMin,
      tMax: obj.tMax,
      samples: obj.samples,
      clampCoordinate: 10_000
    });
  } catch {
    return null;
  }

  const hi = axisComponentIndex(horizontal);
  const vi = axisComponentIndex(vertical);
  const pointCount = sampled.positions.length / 3;
  if (pointCount < 2) {
    return null;
  }

  const poly = new Float64Array(pointCount * 2);
  for (let i = 0; i < pointCount; i += 1) {
    poly[i * 2] = sampled.positions[i * 3 + hi];
    poly[i * 2 + 1] = sampled.positions[i * 3 + vi];
  }

  return poly;
}

function getAxisPairSpec(pair: Axis2DPair): AxisPairSpec {
  if (pair === "yz") {
    return {
      horizontal: "y",
      vertical: "z",
      horizontalLabel: "Y",
      verticalLabel: "Z"
    };
  }

  if (pair === "xz") {
    return {
      horizontal: "x",
      vertical: "z",
      horizontalLabel: "X",
      verticalLabel: "Z"
    };
  }

  return {
    horizontal: "x",
    vertical: "y",
    horizontalLabel: "X",
    verticalLabel: "Y"
  };
}

function formatNumber(n: number): string {
  if (Math.abs(n) < 1e-10) {
    return "0";
  }
  if (Math.abs(n) >= 1000 || Math.abs(n) < 0.001) {
    return n.toExponential(1);
  }
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0
  });
}

function formatCoord(n: number): string {
  if (Math.abs(n) < 1e-10) {
    return "0";
  }
  if (Math.abs(n) >= 100 || Math.abs(n) < 0.01) {
    return n.toExponential(2);
  }
  return n.toFixed(2);
}

function formatProbeCoord(n: number): string {
  if (!Number.isFinite(n)) {
    return "NaN";
  }
  if (Math.abs(n) < 1e-12) {
    return "0";
  }
  if (Math.abs(n) >= 1e4 || Math.abs(n) < 1e-4) {
    return n.toExponential(8);
  }
  return n.toFixed(6);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function alignToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

