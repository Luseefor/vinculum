"use client";

import type { RefObject } from "react";
import type { Axis2DPair, Canvas2DTool, GraphProbePin, Viewport2D } from "@/types/graphUi";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";
import { Graph2DCanvasUiBottomLeftColumn } from "./Graph2DCanvasUiBottomLeftColumn";
import { Graph2DCanvasUiCursorTooltip } from "./Graph2DCanvasUiCursorTooltip";
import { Graph2DCanvasUiZoomCluster } from "./Graph2DCanvasUiZoomCluster";
import type { AxisPairSpec, MousePosition, SketchFitPreview } from "./graph2dCanvasTypes";
import type { Viewport2dVisibleRange } from "./graph2dViewportRange";

export type Graph2DCanvasUiChromeProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  mousePos: MousePosition | null;
  axisPair: AxisPairSpec;
  canvas2dTool: Canvas2DTool;
  viewport: Pick<Viewport2D, "scale">;
  patchViewport2D: (patch: { scale?: number; centerX?: number; centerY?: number }) => void;
  resetViewForCanvas: () => void;
  sketchFitPreview: SketchFitPreview | null;
  setSketchFitPreview: (v: SketchFitPreview | null) => void;
  addSketchedParametricFromStroke: (stroke: { horizontal: number; vertical: number }[], axisPair?: Axis2DPair) => string;
  isQuadTop: boolean;
  axis2dPairQuadTop: Axis2DPair;
  probePins: GraphProbePin[];
  measurements: SceneMeasurement[];
  measurementDraft: { kind: "distance" | "angle"; points: { x: number; y: number; z: number }[] } | null;
  pairForCanvas: Axis2DPair;
  viewportRange: Viewport2dVisibleRange;
};

export function Graph2DCanvasUiChrome(props: Graph2DCanvasUiChromeProps) {
  const {
    containerRef,
    mousePos,
    axisPair,
    canvas2dTool,
    viewport,
    patchViewport2D,
    resetViewForCanvas,
    sketchFitPreview,
    setSketchFitPreview,
    addSketchedParametricFromStroke,
    isQuadTop,
    axis2dPairQuadTop,
    probePins,
    measurements,
    measurementDraft,
    pairForCanvas,
    viewportRange
  } = props;

  return (
    <>
      {mousePos && (
        <Graph2DCanvasUiCursorTooltip
          containerRef={containerRef}
          mousePos={mousePos}
          axisPair={axisPair}
          canvas2dTool={canvas2dTool}
        />
      )}

      <Graph2DCanvasUiZoomCluster
        viewport={viewport}
        patchViewport2D={patchViewport2D}
        resetViewForCanvas={resetViewForCanvas}
      />

      <Graph2DCanvasUiBottomLeftColumn
        mousePos={mousePos}
        axisPair={axisPair}
        canvas2dTool={canvas2dTool}
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
    </>
  );
}
