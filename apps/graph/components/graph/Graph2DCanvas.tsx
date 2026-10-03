"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";
import { getScalarSyncContext, syncScalarViz } from "@/lib/compute/scalarVizSync";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { getStreamlineSyncContext, syncStreamlines } from "@/lib/compute/streamlineSync";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
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
import { parametersToScope } from "@/lib/store/editorParameters";
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
  suspended?: boolean;
}

export function Graph2DCanvas({ className = "", variant = "primary", suspended = false }: Graph2DCanvasProps) {
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
    selectedMeasurementId,
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

  // S20-R9: parameters thread explicitly into the builder (pure data flow,
  // no ambient store reads inside). Viewport-only changes (pan/zoom) never
  // rebuild: the builder takes no viewport input.
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);

  // S23: scalar-viz configs gate derived heat/contour/gradient attachments;
  // cached worker results paint them. Both subscribe here so results stream
  // in without resampling on pan/zoom (the builder takes no viewport).
  const scalarConfigs = useGraphStore((state) => state.ui.scalarVizBySourceId);
  const scalarResults = useScalarVizResultsStore((state) => state.entries);
  // S24: same pattern for streamline polylines.
  const streamlineConfigs = useGraphStore((state) => state.ui.streamlineVizBySourceId);
  const streamlineResults = useStreamlineResultsStore((state) => state.entries);
  // S28: eigen-toggle liveness for transform layers (build-time only).
  const linearTransformAnalysis = useGraphStore((state) => state.ui.linearTransformAnalysisBySourceId);

  const renderableGraphs = useMemo<RenderableGraph[]>(
    () => buildRenderableGraphsFromScene(objects, axisPair, paramScope, scalarConfigs, streamlineConfigs, linearTransformAnalysis),
    [axisPair, objects, paramScope, scalarConfigs, streamlineConfigs, linearTransformAnalysis]
  );

  // S23: request desired scalar jobs when sources/configs/params change.
  // Signature-tracked: viewport-only changes enqueue 0 jobs.
  useEffect(() => {
    syncScalarViz(getScalarSyncContext(), objects, paramScope);
  }, [objects, paramScope, scalarConfigs]);

  // S24: same for streamline jobs (shared signature ledger per context, so
  // the two canvases never double-request).
  useEffect(() => {
    syncStreamlines(getStreamlineSyncContext(), objects, paramScope);
  }, [objects, paramScope, streamlineConfigs]);

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
    theme: resolvedTheme,
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
  });

  const scenePressure = useMemo(
    () => computeScenePressureFromObjects(objects, streamlineConfigs),
    [objects, streamlineConfigs]
  );
  const drawMeasured = useCallback(() => {
    if (suspended) return;
    const start = performance.now();
    draw();
    const end = performance.now();
    recordPaintSample({
      nowMs: end,
      paintTimeMs: end - start,
      viewport: "2d-viewport",
      scenePressure
    });
  }, [draw, scenePressure, suspended]);

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
    canvas2dTool === "pan"
      ? "cursor-grab touch-none active:cursor-grabbing"
      : canvas2dTool === "draw"
        ? "cursor-cell touch-none"
        : "cursor-crosshair touch-none";
  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="2D graph. Pan, probe, measure, pin, or sketch. Press Escape to clear measurement drafts or cancel a sketch."
        tabIndex={0}
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
          // Bottom-right, left of the zoom stack and clear of the pane label.
          className={`pointer-events-none absolute bottom-3 right-[3.75rem] z-[22] flex max-w-[min(300px,calc(100%-6rem))] flex-col gap-0.5 rounded-[var(--radius-md)] border bg-[var(--surface-overlay)] px-3 py-2 text-[11px] leading-snug shadow-[var(--shadow-control)] ${
            metrics.warningLevel === "critical"
              ? "border-[var(--status-error-border)] text-[var(--status-error-fg)]"
              : metrics.warningLevel === "warning"
                ? "border-[var(--status-warning-border)] text-[var(--status-warning-fg)]"
                : "border-[var(--border-subtle)] font-mono text-[var(--text-secondary)]"
          }`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {showPerfHud ? (
            <>
              <div>
                Paint {metrics.lastFrameTimeMs !== null ? metrics.lastFrameTimeMs.toFixed(1) : "--"}ms
              </div>
              <div>
                Obj {metrics.scenePressure.visibleObjectCount}/{metrics.scenePressure.objectCount}
              </div>
              <div>
                Res {Math.round(metrics.scenePressure.surfaceResolutionMax)} · Smp {Math.round(metrics.scenePressure.parametricSamplesMax)}
              </div>
            </>
          ) : null}
          {metrics.warningLevel !== "ok" ? (
            <>
              <div className="font-semibold">{metrics.warningSummary}</div>
              {metrics.warningItems[0] ? <div>{metrics.warningItems[0]}</div> : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
