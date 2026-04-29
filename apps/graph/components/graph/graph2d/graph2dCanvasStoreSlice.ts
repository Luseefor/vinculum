import type { GraphStoreState } from "@/store/graphStore";

/**
 * Plain selector for tests and for {@link useGraph2dCanvasStoreSlice}.
 * `probePins` uses reference equality: if the store replaces the `ui` object often,
 * expect extra canvas re-renders until the store uses stable `probePins` references
 * when pins are unchanged.
 */
export function selectGraph2dCanvasSlice(state: GraphStoreState, isQuadTop: boolean) {
  return {
    objects: state.scene.objects,
    viewport: isQuadTop ? state.ui.viewport2dQuadTop : state.ui.viewport2d,
    viewportFrame: isQuadTop ? state.ui.viewport2dQuadTopFrame : state.ui.viewport2dFrame,
    axis2dPairQuadTop: state.ui.axis2dPairQuadTop,
    pairForCanvas: isQuadTop ? state.ui.axis2dPairQuadTop : state.ui.axis2dPair,
    canvas2dTool: state.ui.canvas2dTool,
    snapEnabled: state.ui.snapEnabled,
    snapStep: state.ui.snapStep,
    probePins: state.ui.probePins,
    measurements: state.scene.measurements,
    measurementDraft: state.ui.measurementDraft,
    patchViewport2D: isQuadTop ? state.updateViewport2DQuadTop : state.updateViewport2D,
    setFrameForCanvas: isQuadTop ? state.setViewport2DQuadTopFrame : state.setViewport2DFrame,
    resetViewForCanvas: isQuadTop ? state.resetViewport2DQuadTop : state.resetViewport2D,
    setActive2dViewport: state.setActive2dViewport,
    setProbePinnedMath: state.setProbePinnedMath,
    removeProbePin: state.removeProbePin,
    clearProbes: state.clearProbes,
    addSketchedParametricFromStroke: state.addSketchedParametricFromStroke,
    sketchAutoCreate: state.ui.sketchAutoCreate
  };
}

export type Graph2dCanvasStoreSlice = ReturnType<typeof selectGraph2dCanvasSlice>;
