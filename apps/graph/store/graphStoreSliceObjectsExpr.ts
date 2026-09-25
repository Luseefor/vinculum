import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { findObjectById } from "./graphStoreSelection";
import { updateImplicitSurfaceField } from "./graphStoreImplicitSurfaceField";
import { updateParametricCurveField } from "./graphStoreParametricField";
import { updateParametricSurfaceField } from "./graphStoreParametricSurfaceField";
import { updateVectorFieldField } from "./graphStoreVectorFieldField";
import { pruneAnalysisForSourceId, pruneVectorCalculusForSourceId } from "./graphStoreSliceAnalysis";
import { pruneIntegralForSourceId } from "./graphStoreSliceIntegral";
import { pruneScalarVizForSourceId } from "./graphStoreSliceScalarViz";
import { pruneStreamlineForSourceId } from "./graphStoreSliceStreamline";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";
import type { GraphUiState } from "@/types/graphUi";

// S25 lifecycle contract (PART 40/41):
// - target/field MATH commits drop integral RESULTS but KEEP configs: the
//   composite signature changes, the display gate hides the old number,
//   and the Inspector effect recomputes automatically ("recompute
//   required"). Unlike pick-anchored S21/S22 analysis, integrals have no
//   user anchor that an edit can invalidate.
// - delete/kind-switch/scene-replace clears configs outright (see
//   B/Insert/Scene slices).
// - render sampling (curve samples, surface resolution), glyph/appearance
//   edits, visibility, and theme touch NOTHING, not even results, because
//   the signature cannot change (PART 39/40/61 pins).
// Drops cached integral results for configs referencing an edited
// vector field (configs kept for auto-recompute). Runs inside set()
// updaters, like the S19 manager's cross-store writes — safe across
// stores (the results store is a leaf dependency).
function dropReferencingIntegralResults(ui: GraphUiState, fieldId: string): GraphUiState {
  for (const [sourceId, config] of Object.entries(ui.integralAnalysisBySourceId)) {
    if (config.vectorFieldId === fieldId) {
      useIntegralResultsStore.getState().removeForSource(sourceId);
    }
  }
  return ui;
}

export function buildObjectsSliceExpr(set: GraphStoreSet): Pick<
  GraphStoreState,
  "updateSurfaceEquation" | "updateSurfaceOrientation" | "updateParametricExpression" | "updateParametricSurfaceExpression" | "updateImplicitSurfaceExpression" | "updateVectorFieldExpression" | "updatePlaneEquation"
> {
  return {
    updateSurfaceEquation: (id, equation) => {
      // S23: equation commits change the scalar mathematics (config pruned
      // here; fresh results recompute on next sync). Updater stays pure.
      // S25: integral results drop (config kept for auto-recompute).
      useScalarVizResultsStore.getState().removeForSource(id);
      useIntegralResultsStore.getState().removeForSource(id);
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "surface") {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: {
              ...object,
              equation
            }
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          // S23: scalar-viz config likewise (independent variables move).
          // S25: integral results drop (config kept for auto-recompute).
          ui: pruneScalarVizForSourceId(pruneAnalysisForSourceId(state.ui, id), id)
        };
      });
    },

    updateSurfaceOrientation: (id, orientation) => {
      useScalarVizResultsStore.getState().removeForSource(id);
      useIntegralResultsStore.getState().removeForSource(id);
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "surface") {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: {
              ...object,
              orientation
            }
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          // S23: scalar-viz config likewise.
          // S25: integral results dropped pre-set (config kept).
          ui: pruneScalarVizForSourceId(pruneAnalysisForSourceId(state.ui, id), id)
        };
      });
    },

    updateParametricExpression: (id, field, value) => {
      // S25: axis/t-domain commits drop integral results (config kept for
      // auto-recompute); render sampling (samples) touches nothing.
      if (field !== "samples") {
        useIntegralResultsStore.getState().removeForSource(id);
      }
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "parametricCurve") {
          return state;
        }

        const nextObject = updateParametricCurveField(object, field, value);
        if (!nextObject) {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: nextObject
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          // S25: integral results dropped pre-set (config kept).
          ui: pruneAnalysisForSourceId(state.ui, id)
        };
      });
    },

    updateParametricSurfaceExpression: (id, field, value) => {
      // S25: axis/u-v-domain commits drop integral results (config kept
      // for auto-recompute); render tessellation (resolution) touches
      // nothing (PART 39 pin).
      if (field !== "resolution") {
        useIntegralResultsStore.getState().removeForSource(id);
      }
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "parametricSurface") {
          return state;
        }

        const nextObject = updateParametricSurfaceField(object, field, value);
        if (!nextObject) {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: nextObject
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          // S25: integral results dropped pre-set (config kept).
          ui: pruneAnalysisForSourceId(state.ui, id)
        };
      });
    },

    updateImplicitSurfaceExpression: (id, field, value) => {
      // S23: equation/domain commits prune scalar viz; resolution commits
      // do not (fixed internal grid resolutions make them a scalar no-op,
      // unlike the S21 mesh-coupled analysis which prunes on any commit).
      if (field !== "resolution") {
        useScalarVizResultsStore.getState().removeForSource(id);
      }
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "implicitSurface") {
          return state;
        }

        const nextObject = updateImplicitSurfaceField(object, field, value);
        if (!nextObject) {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: nextObject
          }
        };

        const nextUi = pruneAnalysisForSourceId(state.ui, id);
        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: field === "resolution" ? nextUi : pruneScalarVizForSourceId(nextUi, id)
        };
      });
    },

    updateVectorFieldExpression: (id, field, value) => {
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "vectorField") {
          return state;
        }

        const nextObject = updateVectorFieldField(object, field, value);
        if (!nextObject) {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: nextObject
          }
        };

        // S22 PART 8/33: only mathematical edits invalidate vector
        // calculus (components, domain). Density/scale/normalize/color
        // change sampling/rendering, never the function — analysis stays.
        // S24 streamlines share the same math identity, so they prune on
        // exactly the same fields (glyph config never triggers jobs).
        // S25: referencing integral results drop (configs kept for
        // auto-recompute under the new composite signature).
        const mathFields = new Set([
          "pExpr",
          "qExpr",
          "rExpr",
          "xMin",
          "xMax",
          "yMin",
          "yMax",
          "zMin",
          "zMax"
        ]);
        if (mathFields.has(field)) {
          useStreamlineResultsStore.getState().removeForSource(id);
        }
        return {
          scene: applySceneCommand(state.scene, command),
          ui: mathFields.has(field)
            ? dropReferencingIntegralResults(
                pruneStreamlineForSourceId(pruneVectorCalculusForSourceId(state.ui, id), id),
                id
              )
            : state.ui
        };
      });
    },

    updatePlaneEquation: (id, equation) => {
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.kind !== "plane") {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: {
              ...object,
              equation
            }
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
        };
      });
    }
  };
}
