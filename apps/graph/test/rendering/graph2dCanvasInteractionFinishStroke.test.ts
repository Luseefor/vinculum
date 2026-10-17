import { describe, expect, it, vi } from "vitest";
import { finalizeGraph2dSketchStroke } from "@/components/graph/graph2d/graph2dCanvasInteractionFinishStroke";

describe("finalizeGraph2dSketchStroke", () => {
  it("does nothing when the stroke is too short", () => {
    const add = vi.fn();
    const setPreview = vi.fn();
    finalizeGraph2dSketchStroke({
      stroke: [{ horizontal: 0, vertical: 0 }],
      sketchAutoCreate: false,
      isQuadTop: false,
      axis2dPairQuadTop: "xz",
      addSketchedParametricFromStroke: add,
      setSketchFitPreview: setPreview
    });
    expect(add).not.toHaveBeenCalled();
    expect(setPreview).not.toHaveBeenCalled();
  });
});
