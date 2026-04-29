"use client";

import { useRef, useMemo, useCallback } from "react";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { getAxisPairSpec } from "./graph2d/graph2dCanvasAxis";
import { buildRenderableGraphsFromScene } from "./graph2d/buildRenderableGraphsFromScene";
import { Graph2DCanvasUiChrome } from "./graph2d/Graph2DCanvasUiChrome";
import { graph2dPaintPalette } from "./graph2d/graph2dPaintPalette";
import type { RenderableGraph } from "./graph2d/graph2dCanvasTypes";
import { computeViewport2dRange } from "./graph2d/graph2dViewportRange";
import { useGraph2dCanvasDraw } from "./graph2d/useGraph2dCanvasDraw";
import { useGraph2dCanvasInteraction } from "./graph2d/useGraph2dCanvasInteraction";
import { useGraph2dCanvasPaintSchedule } from "./graph2d/useGraph2dCanvasPaintSchedule";
import { useGraph2dCanvasStoreSlice } from "./graph2d/useGraph2dCanvasStoreSlice";
import { useEditorStore } from "@/lib/store/editorStore";
import {
  computeScenePressureFromObjects,
  recordPaintSample
} from "@/lib/performance/performanceMetrics";
import { usePerformanceMetricsSnapshot } from "@/lib/performance/usePerformanceMetrics";

export type Graph2DCanvasVariant = "primary" | "quadTop";

interface Graph2DCanvasProps {
  className?: string;
  /** Quad bottom-right: XZ top view with its own pan/zoom state. */
  variant?: Graph2DCanvasVariant;
}

export function Graph2DCanvas({ className = "", variant = "primary" }: Graph2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedTheme = useResolvedTheme();
  const isQuadTop = variant === "quadTop";
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
  const metrics = usePerformanceMetricsSnapshot();

  const {
    objects,
    viewport,
    viewportFrame,
    pairForCanvas,
    axis2dPairQuadTop,
    canvas2dTool,
    snapEnabled,
    snapStep,
    probePins,
    measurements,
    measurementDraft,
    patchViewport2D,
    setFrameForCanvas,
    resetViewForCanvas,
    setActive2dViewport,
    setProbePinnedMath,
    removeProbePin,
    clearProbes,
    addSketchedParametricFromStroke,
    sketchAutoCreate
  } = useGraph2dCanvasStoreSlice(isQuadTop);

  const axisPair = useMemo(() => getAxisPairSpec(pairForCanvas), [pairForCanvas]);

  const palette = useMemo(() => graph2dPaintPalette(resolvedTheme), [resolvedTheme]);

  const renderableGraphs = useMemo<RenderableGraph[]>(
    () => buildRenderableGraphsFromScene(objects, axisPair),
    [axisPair, objects]
  );

  const {
    mousePos,
    sketchDraft,
    sketchFitPreview,
    setSketchFitPreview,
    canvasHandlers
  } = useGraph2dCanvasInteraction({
    canvasRef,
    isQuadTop,
    canvas2dTool,
    viewport,
    pairForCanvas,
    axis2dPairQuadTop,
    snapEnabled,
    snapStep,
    probePins,
    sketchAutoCreate,
    patchViewport2D,
    setActive2dViewport,
    setProbePinnedMath,
    removeProbePin,
    clearProbes,
    addSketchedParametricFromStroke
  });

  const draw = useGraph2dCanvasDraw({
    canvasRef,
    containerRef,
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
  });

  const scenePressure = useMemo(() => computeScenePressureFromObjects(objects), [objects]);
  const drawMeasured = useCallback(() => {
    const start = performance.now();
    draw();
    const end = performance.now();
    recordPaintSample({
      nowMs: end,
      paintTimeMs: end - start,
      viewport: "2d-viewport",
      scenePressure
    });
  }, [draw, scenePressure]);

  useGraph2dCanvasPaintSchedule({
    canvasRef,
    containerRef,
    setFrameForCanvas,
    draw: drawMeasured
  });

  const viewportRange = useMemo(
    () => computeViewport2dRange(viewportFrame, viewport),
    [viewportFrame, viewport]
  );

  const canvasCursorClass =
    canvas2dTool === "pan" ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-crosshair touch-none";

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="2D graph. Pan, probe, measure, pin, or sketch. Press Escape to clear measurement drafts or cancel a sketch."
        data-graph2d-canvas="true"
        data-graph2d-variant={variant}
        className={`h-full w-full ${canvasCursorClass}`}
        {...canvasHandlers}
      />

      <Graph2DCanvasUiChrome
        containerRef={containerRef}
        mousePos={mousePos}
        axisPair={axisPair}
        canvas2dTool={canvas2dTool}
        viewport={viewport}
        patchViewport2D={patchViewport2D}
        resetViewForCanvas={resetViewForCanvas}
        sketchFitPreview={sketchFitPreview}
        setSketchFitPreview={setSketchFitPreview}
        addSketchedParametricFromStroke={addSketchedParametricFromStroke}
        isQuadTop={isQuadTop}
        axis2dPairQuadTop={axis2dPairQuadTop}
        probePins={probePins}
        measurements={measurements}
        measurementDraft={measurementDraft}
        pairForCanvas={pairForCanvas}
        viewportRange={viewportRange}
      />

      {(showPerfHud || metrics.warningLevel !== "ok") && (
        <div
          className="pointer-events-none absolute right-3 top-3 z-[20] max-w-[320px] rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/80 px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] backdrop-blur whitespace-pre-line"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {showPerfHud ? (
            <>
              Paint {metrics.lastFrameTimeMs !== null ? metrics.lastFrameTimeMs.toFixed(1) : "--"}ms
              {"\n"}
              Obj {metrics.scenePressure.visibleObjectCount}/{metrics.scenePressure.objectCount}
              {"\n"}
              Res {Math.round(metrics.scenePressure.surfaceResolutionMax)} · Smp {Math.round(metrics.scenePressure.parametricSamplesMax)}
            </>
          ) : null}
          {metrics.warningLevel !== "ok" ? (
            <>
              {"\n"}
              {metrics.warningSummary}
              {metrics.warningItems[0] ? `\n${metrics.warningItems[0]}` : ""}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
