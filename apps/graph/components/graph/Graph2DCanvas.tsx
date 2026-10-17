"use client";

import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { subscribeCanvasFrameRequests } from "@/lib/interaction/canvasFrameRequests";
import { fitGraph2dViewport } from "./graph2d/graph2dCanvasFit";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";
import { getScalarSyncContext, setScalarVizDisplayDomains, syncScalarViz } from "@/lib/compute/scalarVizSync";
import { planarDisplayDomain2D, surfaceDisplayDomain2D } from "@/lib/graph3d/surfaceDisplayDomain";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { getStreamlineSyncContext, syncStreamlines } from "@/lib/compute/streamlineSync";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import { getAxisPairSpec } from "./graph2d/graph2dCanvasAxis";
import { buildPlanarIntersectionGraphs, buildRenderableGraphsFromScene } from "./graph2d/buildRenderableGraphsFromScene";
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
  const [fitMessage, setFitMessage] = useState<string | null>(null);
  useEffect(() => subscribeCanvasFrameRequests(kind => {
    const state = useGraphStore.getState();
    if (suspended || state.ui.workspace !== "math" || useEditorStore.getState().viewportMode === "quad" && state.ui.active2dViewport !== variant) return;
    const result = fitGraph2dViewport(state.scene.objects, pairForCanvas, getEditorParameterScope(), viewport, viewportFrame, kind === "selected" ? state.ui.selectedObjectId ?? undefined : undefined);
    if (result) patchViewport2D(result.viewport);
    setFitMessage(result ? result.sampled ? "View fitted. Unbounded equations may continue beyond this range." : "View fitted." : "No geometry found in this plane. Change the plane or reset the view.");
  }), [suspended, variant, pairForCanvas, viewport, viewportFrame, patchViewport2D]);
  useEffect(() => {
    if (!fitMessage) return;
    const timer = setTimeout(() => setFitMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [fitMessage]);

  // S20-R9: parameters thread explicitly into the builder (pure data flow,
  // no ambient store reads inside). Viewport-only changes (pan/zoom) never
  // rebuild: the builder takes no viewport input.
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);

  // S23: scalar-viz configs gate derived heat/contour/gradient attachments;
  // cached worker results paint them. Both subscribe here so results stream
  // in when a quantized sampling range changes.
  const scalarConfigs = useGraphStore((state) => state.ui.scalarVizBySourceId);
  const scalarResults = useScalarVizResultsStore((state) => state.entries);
  // S24: same pattern for streamline polylines.
  const streamlineConfigs = useGraphStore((state) => state.ui.streamlineVizBySourceId);
  const streamlineResults = useStreamlineResultsStore((state) => state.entries);
  // S28: eigen-toggle liveness for transform layers (build-time only).
  const linearTransformAnalysis = useGraphStore((state) => state.ui.linearTransformAnalysisBySourceId);

  const geometryConfigs = useGraphStore(state => state.ui.geometryAnalysisBySourceId);
  const analysisDomain = useMemo(() => planarDisplayDomain2D(viewport, viewportFrame), [viewport, viewportFrame]);
  const baseGraphs = useMemo<RenderableGraph[]>(
    () => buildRenderableGraphsFromScene(objects, axisPair, paramScope, scalarConfigs, streamlineConfigs, linearTransformAnalysis),
    [axisPair, objects, paramScope, scalarConfigs, streamlineConfigs, linearTransformAnalysis]
  );

  const renderableGraphs = useMemo(() => axisPair.horizontal === "x" && axisPair.vertical === "y"
    ? [...baseGraphs, ...buildPlanarIntersectionGraphs(objects, geometryConfigs, paramScope, analysisDomain)] : baseGraphs,
    [baseGraphs, objects, geometryConfigs, paramScope, analysisDomain, axisPair]);

  const scalarDomainOwner = useRef({}).current;
  useEffect(() => {
    const context = getScalarSyncContext();
    const attachedIds = new Set(renderableGraphs.flatMap(graph => graph.scalarField ? [graph.scalarField.sourceId] : []));
    const domains = Object.fromEntries(objects.flatMap(object =>
      object.kind === "surface" && attachedIds.has(object.id)
        ? [[object.id, surfaceDisplayDomain2D(object, viewport, viewportFrame)]] : []));
    setScalarVizDisplayDomains(context, scalarDomainOwner, suspended ? null : domains);
    syncScalarViz(context, objects, paramScope);
  }, [objects, paramScope, renderableGraphs, scalarDomainOwner, suspended, viewport, viewportFrame]);

  useEffect(() => () => {
    const context = getScalarSyncContext();
    setScalarVizDisplayDomains(context, scalarDomainOwner, null);
    syncScalarViz(context, useGraphStore.getState().scene.objects, getEditorParameterScope());
  }, [scalarDomainOwner]);

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
    suspended,
    isQuadTop,
    canvas2dTool,
    viewport,
    pairForCanvas,
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
        probePins={probePins}
        measurements={measurements}
        measurementDraft={measurementDraft}
        pairForCanvas={pairForCanvas}
        viewportRange={viewportRange}
      />
      {fitMessage ? <div role="status" data-testid="graph2d-fit-status" className="pointer-events-none absolute bottom-12 left-3 z-30 max-w-[calc(100%-5rem)] rounded-sm bg-(--surface-overlay) px-2 py-1 text-[12px] text-(--text-secondary)">{fitMessage}</div> : null}

      {(showPerfHud || metrics.warningLevel !== "ok") && (
        <div
          // Bottom-right, left of the zoom stack and clear of the pane label.
          className={`pointer-events-none absolute bottom-3 right-15 z-22 flex max-w-[min(300px,calc(100%-6rem))] flex-col gap-0.5 rounded-[var(--ui-radius-md)] border bg-(--surface-overlay) px-3 py-2 text-[11px] leading-snug shadow-(--shadow-control) ${
            metrics.warningLevel === "critical"
              ? "border-(--status-error-border) text-(--status-error-fg)"
              : metrics.warningLevel === "warning"
                ? "border-(--status-warning-border) text-(--status-warning-fg)"
                : "border-(--border-subtle) font-mono text-(--text-secondary)"
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
