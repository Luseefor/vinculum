"use client";

import type { Axis2DPair, Canvas2DTool, GraphProbePin } from "@/types/graphUi";
import { Graph2DCanvasUiCursorCoordsBadge } from "./Graph2DCanvasUiCursorCoordsBadge";
import { Graph2DCanvasUiProbePinsSummary } from "./Graph2DCanvasUiProbePinsSummary";
import { Graph2DCanvasUiSketchFitPreview } from "./Graph2DCanvasUiSketchFitPreview";
import { Graph2DCanvasUiViewportRangeBadge } from "./Graph2DCanvasUiViewportRangeBadge";
import type { AxisPairSpec, MousePosition, SketchFitPreview } from "./graph2dCanvasTypes";
import type { Viewport2dVisibleRange } from "./graph2dViewportRange";

export type Graph2DCanvasUiBottomLeftColumnProps = {
  mousePos: MousePosition | null;
  axisPair: AxisPairSpec;
  canvas2dTool: Canvas2DTool;
  sketchFitPreview: SketchFitPreview | null;
  setSketchFitPreview: (v: SketchFitPreview | null) => void;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  isQuadTop: boolean;
  axis2dPairQuadTop: Axis2DPair;
  probePins: GraphProbePin[];
  pairForCanvas: Axis2DPair;
  viewportRange: Viewport2dVisibleRange;
};

export function Graph2DCanvasUiBottomLeftColumn(props: Graph2DCanvasUiBottomLeftColumnProps) {
  const {
    mousePos,
    axisPair,
    canvas2dTool,
    sketchFitPreview,
    setSketchFitPreview,
    addSketchedParametricFromStroke,
    isQuadTop,
    axis2dPairQuadTop,
    probePins,
    pairForCanvas,
    viewportRange
  } = props;

  return (
    <div className="absolute bottom-24 left-3 z-20 flex max-w-[min(520px,calc(100%-1.5rem))] flex-col gap-1">
      {sketchFitPreview && (
        <Graph2DCanvasUiSketchFitPreview
          axisPair={axisPair}
          sketchFitPreview={sketchFitPreview}
          setSketchFitPreview={setSketchFitPreview}
          addSketchedParametricFromStroke={addSketchedParametricFromStroke}
          isQuadTop={isQuadTop}
          axis2dPairQuadTop={axis2dPairQuadTop}
        />
      )}
      {mousePos && (
        <Graph2DCanvasUiCursorCoordsBadge mousePos={mousePos} axisPair={axisPair} canvas2dTool={canvas2dTool} />
      )}
      {!isQuadTop && probePins.length > 0 && (
        <Graph2DCanvasUiProbePinsSummary axisPair={axisPair} probePins={probePins} pairForCanvas={pairForCanvas} />
      )}
      <Graph2DCanvasUiViewportRangeBadge axisPair={axisPair} viewportRange={viewportRange} />
    </div>
  );
}
