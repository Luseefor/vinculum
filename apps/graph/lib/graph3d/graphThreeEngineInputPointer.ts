import { useGraphStore } from "@/store/graphStore";
import { getComputeStatusForObject } from "@/lib/compute/geometryComputeStatus";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { isCleanClick } from "@/lib/interaction/canvasInteractionModel";
import { pickAnalysisSourcePoint } from "./graphThreeAnalysisPick";
import { pickWorldPointFromCanvasPointer } from "./graphThreeEnginePickWorld";
import { pickGeometryPrimitiveAtPointer, pickHitsAnyVisibleObject } from "./graphThreePrimitivePick";
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

    // S26: pan-tool clean clicks select geometric primitives (drag orbits
    // instead). Probe/measure/draw tools keep their behavior; proxies are
    // invisible to those pickers, so selection never steals probe hits.
    if (tool === "pan" && event.button === 0) {
      mutable.primitivePickDown = { x: event.clientX, y: event.clientY };
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
      // S34 PART 50: pointer-aware threshold (touch tolerates finger drift).
      if (isCleanClick(anchor.x, anchor.y, event.clientX, event.clientY, event.pointerType)) {
        attemptAnalysisPick(deps, armedId, event);
      }
    }
    // S26: resolve a pan-tool primitive selection on clean clicks only.
    const primitiveAnchor = mutable.primitivePickDown;
    mutable.primitivePickDown = null;
    if (state.ui.canvas3dTool === "pan" && primitiveAnchor && event) {
      // S34 PART 50: pointer-aware threshold (touch tolerates finger drift).
      if (isCleanClick(primitiveAnchor.x, primitiveAnchor.y, event.clientX, event.clientY, event.pointerType)) {
        attemptPrimitivePick(deps, event);
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

// S26: pan-tool clean-click primitive selection. Misses (and clicks on
// non-primitive objects) leave selection untouched. Exported for unit
// tests; the engine wires it through the pointer handlers above.
export function attemptPrimitivePick(
  deps: GraphThreeEngineInputHandlersDeps,
  event: { clientX: number; clientY: number }
): void {
  const pickOverride = deps.resolvePickContext?.(event.clientX, event.clientY) ?? null;
  const id = pickGeometryPrimitiveAtPointer(event, {
    renderer: deps.renderer,
    camera: deps.camera,
    raycaster: deps.raycaster,
    ndc: deps.ndc,
    objectsRoot: deps.objectsRoot,
    baselinePlane: deps.baselinePlane,
    tempGround: deps.tempGround,
    pickOverride
  });
  if (!id) {
    // S31 deselect (Part DESELECT): a genuine clean miss on empty space
    // clears object selection. Any visible hit — a mesh, a derived overlay,
    // a marker — preserves it. Drags never reach here (moved>=6 returns
    // earlier); probe/measure/draw tools never call this path.
    const store = useGraphStore.getState();
    if (store.ui.selectedObjectId === null) {
      return;
    }
    if (
      pickHitsAnyVisibleObject(event, {
        renderer: deps.renderer,
        camera: deps.camera,
        raycaster: deps.raycaster,
        ndc: deps.ndc,
        objectsRoot: deps.objectsRoot,
        baselinePlane: deps.baselinePlane,
        tempGround: deps.tempGround,
        pickOverride
      })
    ) {
      return;
    }
    store.deselectObject();
    return;
  }
  useGraphStore.getState().selectObject(id);
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
