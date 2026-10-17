import { applySceneCommand } from "@/lib/scene/applyCommand";
import { findObjectById, resolveSelectedObjectId } from "./graphStoreSelection";
import { clearAllDerivedForSource } from "./graphStoreSliceScalarViz";
import { pruneGeometryAnalysisForSourceId } from "./graphStoreSliceGeometryAnalysis";
import { pruneLinearTransformAnalysisForSourceId } from "./graphStoreSliceLinearTransform";
import { clearIntegralFieldSelection, integralSourcesReferencingField } from "./graphStoreSliceIntegral";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceB(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "toggleObjectVisibility"
  | "setObjectVisibility"
  | "selectObject"
  | "deselectObject"
  | "removeObject"
  | "requestEquationFocus"
  | "clearEquationFocus"
> {
  return {
    toggleObjectVisibility: (id) => {
      set((state) => ({
        scene: applySceneCommand(state.scene, {
          type: "TOGGLE_VISIBILITY",
          payload: {
            id
          }
        })
      }));
    },

    setObjectVisibility: (id, visible) => {
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object || object.visible === visible) {
          return state;
        }
        return {
          scene: applySceneCommand(state.scene, {
            type: "UPDATE_OBJECT",
            payload: {
              object: {
                ...object,
                visible
              }
            }
          })
        };
      });
    },

    selectObject: (id) => {
      set((state) => {
        const exists = state.scene.objects.some((object) => object.id === id);
        if (!exists) {
          return state;
        }

        // S21: selecting away from an armed pick source disarms (the
        // Inspector context moved; a stale armed mode would confuse).
        const armedId = state.ui.differentialAnalysisPickArmedId;
        const disarm = armedId !== null && armedId !== id;

        return {
          ui: {
            ...state.ui,
            selectedObjectId: id,
            differentialAnalysisPickArmedId: disarm ? null : armedId
          }
        };
      });
    },

    // S31 empty-canvas deselect (Part DESELECT): clears object selection on
    // a genuine clean miss. Never disarms an armed analysis pick (S21 misses
    // stay armed), never touches measurements, scene, or history.
    deselectObject: () => {
      set((state) => {
        if (state.ui.selectedObjectId === null) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            selectedObjectId: null
          }
        };
      });
    },

    removeObject: (id) => {
      set((state) => {
        const removeIndex = state.scene.objects.findIndex(object => object.id === id);
        if (removeIndex === -1) return state;
        const nextScene = applySceneCommand(state.scene, { type: "REMOVE_OBJECT", payload: { id } });
        const surviving = new Set(nextScene.objects.map(object => object.id));
        const removed = state.scene.objects.filter(object => !surviving.has(object.id));
        const fallback = state.scene.objects.slice(removeIndex + 1).find(object => surviving.has(object.id))
          ?? state.scene.objects.slice(0, removeIndex).reverse().find(object => surviving.has(object.id));
        let ui = state.ui;
        for (const object of removed) {
          useScalarVizResultsStore.getState().removeForSource(object.id);
          useStreamlineResultsStore.getState().removeForSource(object.id);
          useIntegralResultsStore.getState().removeForSource(object.id);
          for (const sourceId of integralSourcesReferencingField(ui, object.id)) {
            useIntegralResultsStore.getState().removeForSource(sourceId);
          }
          ui = clearIntegralFieldSelection(clearAllDerivedForSource(
            pruneLinearTransformAnalysisForSourceId(pruneGeometryAnalysisForSourceId(ui, object.id), object.id), object.id), object.id);
        }
        return {
          scene: nextScene,
          ui: {
            ...ui,
            selectedObjectId: state.ui.selectedObjectId && !surviving.has(state.ui.selectedObjectId)
              ? fallback?.id ?? null : resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects),
            focusEquationForObjectId: state.ui.focusEquationForObjectId && surviving.has(state.ui.focusEquationForObjectId)
              ? state.ui.focusEquationForObjectId : null
          }
        };
      });
    },

    requestEquationFocus: (id) => {
      set((state) => {
        if (!state.scene.objects.some((object) => object.id === id)) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            focusEquationForObjectId: id
          }
        };
      });
    },

    clearEquationFocus: () => {
      set((state) => {
        if (state.ui.focusEquationForObjectId === null) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            focusEquationForObjectId: null
          }
        };
      });
    }
  };
}
