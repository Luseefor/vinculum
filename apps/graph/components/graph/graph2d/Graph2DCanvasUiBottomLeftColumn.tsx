"use client";

import type { Axis2DPair, Canvas2DTool, GraphProbePin } from "@/types/graphUi";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";
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
  measurements: SceneMeasurement[];
  measurementDraft: { kind: "distance" | "angle"; points: { x: number; y: number; z: number }[] } | null;
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
    measurements,
    measurementDraft,
    pairForCanvas,
    viewportRange
  } = props;

  const showProbeBlock =
    !isQuadTop &&
    (probePins.length > 0 || measurements.some((measurement) => measurement.kind !== "pin") || measurementDraft);

  return (
    <div className="absolute bottom-24 left-3 z-[24] flex max-h-[calc(100%-7rem)] max-w-[min(480px,calc(100%-4rem))] min-w-0 flex-col gap-1.5 overflow-hidden">
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
      <div className="flex min-w-0 flex-col gap-1 overflow-y-auto rounded-[5px] border border-[var(--border-subtle)]/70 bg-[var(--surface-overlay)]/88 p-2 shadow-sm backdrop-blur-sm">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">2D Graph • {axisPair.horizontalLabel}{axisPair.verticalLabel}</div>
        <div className="flex min-w-0 flex-col divide-y divide-[var(--border-subtle)]/55">
          {mousePos ? (
            <div className="min-w-0 py-1 first:pt-0">
              <Graph2DCanvasUiCursorCoordsBadge mousePos={mousePos} axisPair={axisPair} canvas2dTool={canvas2dTool} embedded />
            </div>
          ) : null}
          {showProbeBlock ? (
            <div className="min-w-0 py-1">
              <Graph2DCanvasUiProbePinsSummary
                axisPair={axisPair}
                probePins={probePins}
                measurements={measurements}
                measurementDraft={measurementDraft}
                pairForCanvas={pairForCanvas}
                embedded
              />
            </div>
          ) : null}
          <div className="min-w-0 py-1">
            <Graph2DCanvasUiViewportRangeBadge axisPair={axisPair} viewportRange={viewportRange} embedded />
          </div>
        </div>
      </div>
    </div>
  );
}
