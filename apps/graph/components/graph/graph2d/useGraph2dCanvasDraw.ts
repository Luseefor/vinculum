"use client";

import { type RefObject, useCallback } from "react";
import type { Axis2DPair, Canvas2DTool, GraphProbePin, Viewport2D } from "@/types/graphUi";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";
import { paintGraph2dCanvasFrame } from "./graph2dCanvasPaintFrame";
import type { AxisPairSpec, Graph2dPaintPalette, MousePosition, RenderableGraph } from "./graph2dCanvasTypes";

export type UseGraph2dCanvasDrawParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  palette: Graph2dPaintPalette;
  viewport: Viewport2D;
  renderableGraphs: RenderableGraph[];
  canvas2dTool: Canvas2DTool;
  mousePos: MousePosition | null;
  isQuadTop: boolean;
  probePins: GraphProbePin[];
  measurements: SceneMeasurement[];
  selectedMeasurementId: string | null;
  pairForCanvas: Axis2DPair;
  axisPair: AxisPairSpec;
  sketchDraft: { horizontal: number; vertical: number }[] | null;
};

export function useGraph2dCanvasDraw(params: UseGraph2dCanvasDrawParams): () => void {
  const {
    canvasRef,
    containerRef,
    palette,
    viewport,
    renderableGraphs,
    canvas2dTool,
    mousePos,
    isQuadTop,
    probePins,
    measurements,
    selectedMeasurementId,
    pairForCanvas,
    axisPair,
    sketchDraft
  } = params;

  return useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    paintGraph2dCanvasFrame({
      canvas,
      container,
      palette,
      viewport,
      renderableGraphs,
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
  }, [
    axisPair,
    canvas2dTool,
    canvasRef,
    containerRef,
    isQuadTop,
    mousePos,
    palette,
    pairForCanvas,
    probePins,
    measurements,
    renderableGraphs,
    selectedMeasurementId,
    sketchDraft,
    viewport
  ]);
}
