import { beforeEach, describe, expect, it } from "vitest";
import { selectGraph2dCanvasSlice } from "@/components/graph/graph2d/graph2dCanvasStoreSlice";
import { useGraphStore } from "@/store/graphStore";

describe("selectGraph2dCanvasSlice", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("uses primary viewport, frame, and patch when isQuadTop is false", () => {
    const state = useGraphStore.getState();
    const slice = selectGraph2dCanvasSlice(state, false);
    expect(slice.viewport).toBe(state.ui.viewport2d);
    expect(slice.viewportFrame).toBe(state.ui.viewport2dFrame);
    expect(slice.patchViewport2D).toBe(state.updateViewport2D);
    expect(slice.setFrameForCanvas).toBe(state.setViewport2DFrame);
    expect(slice.resetViewForCanvas).toBe(state.resetViewport2D);
    expect(slice.pairForCanvas).toBe(state.ui.axis2dPair);
  });

  it("uses quad-top viewport, frame, and patch when isQuadTop is true", () => {
    const state = useGraphStore.getState();
    const slice = selectGraph2dCanvasSlice(state, true);
    expect(slice.viewport).toBe(state.ui.viewport2dQuadTop);
    expect(slice.viewportFrame).toBe(state.ui.viewport2dQuadTopFrame);
    expect(slice.patchViewport2D).toBe(state.updateViewport2DQuadTop);
    expect(slice.setFrameForCanvas).toBe(state.setViewport2DQuadTopFrame);
    expect(slice.resetViewForCanvas).toBe(state.resetViewport2DQuadTop);
    expect(slice.pairForCanvas).toBe(state.ui.axis2dPairQuadTop);
  });
});
