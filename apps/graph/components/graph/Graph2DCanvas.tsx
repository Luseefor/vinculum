"use client";

import { useRef, useMemo } from "react";
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

  useGraph2dCanvasPaintSchedule({
    canvasRef,
    containerRef,
    setFrameForCanvas,
    draw
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
        aria-label="2D graph. Pan, probe, or sketch. Press Escape to clear probes or cancel a sketch."
        data-graph2d-canvas="true"
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
        pairForCanvas={pairForCanvas}
        viewportRange={viewportRange}
      />
    </div>
  );
}
