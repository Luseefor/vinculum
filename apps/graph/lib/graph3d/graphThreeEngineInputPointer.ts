import { useGraphStore } from "@/store/graphStore";
import { getComputeStatusForObject } from "@/lib/compute/geometryComputeStatus";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { pickAnalysisSourcePoint } from "./graphThreeAnalysisPick";
import { pickWorldPointFromCanvasPointer } from "./graphThreeEnginePickWorld";
import type { GraphThreeEngineInputHandlersDeps } from "./graphThreeEngineInputTypes";
import { appendThreeSketchPoint, clearThreeSketch } from "./graphThreeSketchStroke";
import { constrainSketchPointToBaselinePlane } from "./graphThreeEngineSketchBaseline";

function pickWorld(deps: GraphThreeEngineInputHandlersDeps, event: { clientX: number; clientY: number }) {
  const pickOverride = deps.resolvePickContext?.(event.clientX, event.clientY) ?? null;
  return pickWorldPointFromCanvasPointer(event, {
    renderer: deps.renderer,
    camera: deps.camera,
    raycaster: deps.raycaster,
    ndc: deps.ndc,
    objectsRoot: deps.objectsRoot,
    baselinePlane: deps.baselinePlane,
    tempGround: deps.tempGround,
    pickOverride
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
    if (tool === "probe" || tool === "addPin" || tool === "measureDistance" || tool === "measureAngle") {
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
    // S21: an armed analysis pick consumes the next clean click (the
    // drag-vs-click decision happens on pointerup). Tool flows pause while
    // armed so one gesture never pins a probe and picks analysis at once.
    if (state.ui.differentialAnalysisPickArmedId) {
      mutable.analysisPickDown = { x: event.clientX, y: event.clientY };
      return;
    }
    const tool = state.ui.canvas3dTool;
    if (tool === "probe" || tool === "addPin" || tool === "measureDistance" || tool === "measureAngle") {
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

  const handlePointerUp = (event?: PointerEvent) => {
    const state = useGraphStore.getState();
    // S21: resolve an armed analysis pick on clean clicks only (drags
    // orbit instead). Misses and pending-source clicks stay armed.
    const armedId = state.ui.differentialAnalysisPickArmedId;
    const anchor = mutable.analysisPickDown;
    mutable.analysisPickDown = null;
    if (armedId && anchor && event) {
      const moved = Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y);
      if (moved < 6) {
        attemptAnalysisPick(deps, armedId, event);
      }
    }
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
    mutable.analysisPickDown = null;
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

// S21: clean-click analysis pick for the armed source. Refuses while the
// source has pending compute (PART 35: the visible mesh may be stale), and
// ignores clicks that land on other objects or empty space (stays armed).
// Exported for unit tests (pending gate, kind exclusion); the engine wires
// it through the pointer handlers above.
export function attemptAnalysisPick(
  deps: GraphThreeEngineInputHandlersDeps,
  sourceId: string,
  event: { clientX: number; clientY: number }
): void {
  const state = useGraphStore.getState();
  const source = state.scene.objects.find((object) => object.id === sourceId);
  const structure = source ? analysisSourceIdentity(source) : null;
  if (!source || structure === null) {
    state.armDifferentialAnalysisPick(null);
    return;
  }
  if (getComputeStatusForObject(sourceId) !== "idle") {
    return;
  }
  const pickOverride = deps.resolvePickContext?.(event.clientX, event.clientY) ?? null;
  const point = pickAnalysisSourcePoint(
    event,
    {
      renderer: deps.renderer,
      camera: deps.camera,
      raycaster: deps.raycaster,
      ndc: deps.ndc,
      objectsRoot: deps.objectsRoot,
      baselinePlane: deps.baselinePlane,
      tempGround: deps.tempGround,
      pickOverride
    },
    sourceId
  );
  if (!point) {
    return;
  }
  state.setDifferentialAnalysisPoint(sourceId, point, structure);
}
