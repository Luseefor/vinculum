import { useGraphStore } from "@/store/graphStore";
import { pickWorldPointFromCanvasPointer } from "./graphThreeEnginePickWorld";
import type { GraphThreeEngineInputHandlersDeps } from "./graphThreeEngineInputTypes";
import { appendThreeSketchPoint, clearThreeSketch } from "./graphThreeSketchStroke";
import { constrainSketchPointToBaselinePlane } from "./graphThreeEngineSketchBaseline";

function pickWorld(deps: GraphThreeEngineInputHandlersDeps, event: { clientX: number; clientY: number }) {
  return pickWorldPointFromCanvasPointer(event, {
    renderer: deps.renderer,
    camera: deps.camera,
    raycaster: deps.raycaster,
    ndc: deps.ndc,
    objectsRoot: deps.objectsRoot,
    baselinePlane: deps.baselinePlane,
    tempGround: deps.tempGround
  });
}

export function createGraphThreePointerInputHandlers(deps: GraphThreeEngineInputHandlersDeps) {
  const { mutable, tickRuntime, renderer, sketchGeometry, sketchLine } = deps;

  const appendSketchPoint = (point: { x: number; y: number; z: number }) => {
    mutable.sketchPoints = appendThreeSketchPoint(mutable.sketchPoints, sketchGeometry, sketchLine, point);
  };

  const clearSketch = () => {
    mutable.sketchPoints = clearThreeSketch(sketchGeometry, sketchLine);
  };

  const handlePointerMove = (event: PointerEvent) => {
    const tool = useGraphStore.getState().ui.canvas3dTool;
    if (tool === "probe") {
      const point = pickWorld(deps, event);
      const snappedPoint = point ? deps.maybeSnapPoint(point) : null;
      mutable.hoverProbePoint = snappedPoint;
      if (snappedPoint) {
        const rect = renderer.domElement.getBoundingClientRect();
        deps.setHoverProbeBadge(
          `Probe ${deps.formatProbe(snappedPoint)}`,
          event.clientX - rect.left,
          event.clientY - rect.top
        );
      } else {
        deps.setHoverProbeBadge(null, 0, 0);
      }
      return;
    }

    if (tool === "draw" && mutable.isSketching) {
      const point = pickWorld(deps, event);
      if (!point) {
        return;
      }
      const snapped = deps.maybeSnapPoint(point);
      constrainSketchPointToBaselinePlane(snapped, tickRuntime.baselinePlaneMode);
      appendSketchPoint(snapped);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    const state = useGraphStore.getState();
    const tool = state.ui.canvas3dTool;
    if (tool === "probe") {
      const point = pickWorld(deps, event);
      state.setProbePinnedWorld(point ? deps.maybeSnapPoint(point) : null);
      return;
    }

    if (tool === "draw" && event.button === 0) {
      mutable.isSketching = true;
      const point = pickWorld(deps, event);
      clearSketch();
      if (point) {
        const snapped = deps.maybeSnapPoint(point);
        constrainSketchPointToBaselinePlane(snapped, tickRuntime.baselinePlaneMode);
        appendSketchPoint(snapped);
      }
    }
  };

  const handlePointerUp = () => {
    const state = useGraphStore.getState();
    if (state.ui.canvas3dTool !== "draw" || !mutable.isSketching) {
      return;
    }
    mutable.isSketching = false;
    if (mutable.sketchPoints.length >= 4) {
      state.addSketchedParametricFromStroke3d(mutable.sketchPoints);
    }
    clearSketch();
  };

  const handlePointerLeave = () => {
    mutable.hoverProbePoint = null;
    deps.setHoverProbeBadge(null, 0, 0);
    handlePointerUp();
  };

  return {
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave
  };
}
