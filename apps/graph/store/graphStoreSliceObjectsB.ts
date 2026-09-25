import { applySceneCommand } from "@/lib/scene/applyCommand";
import { findObjectById, resolveSelectedObjectId } from "./graphStoreSelection";
import { clearAllDerivedForSource } from "./graphStoreSliceScalarViz";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceB(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "toggleObjectVisibility"
  | "setObjectVisibility"
  | "selectObject"
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

    removeObject: (id) => {
      // S23: drop cached scalar grids beside the config (no orphan heat).
      // S24: same for cached streamlines (no orphan lines).
      useScalarVizResultsStore.getState().removeForSource(id);
      useStreamlineResultsStore.getState().removeForSource(id);
      set((state) => {
        const removeIndex = state.scene.objects.findIndex((object) => object.id === id);
        if (removeIndex === -1) {
          return state;
        }

        const fallbackObject =
          state.scene.objects[removeIndex + 1] ?? state.scene.objects[removeIndex - 1] ?? null;

        const nextScene = applySceneCommand(state.scene, {
          type: "REMOVE_OBJECT",
          payload: {
            id
          }
        });

        const nextSelectedObjectId =
          state.ui.selectedObjectId === id
            ? fallbackObject?.id ?? null
            : resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects);

        return {
          scene: nextScene,
          ui: {
            ...clearAllDerivedForSource(state.ui, id),
            selectedObjectId: nextSelectedObjectId,
            focusEquationForObjectId:
              state.ui.focusEquationForObjectId === id ? null : state.ui.focusEquationForObjectId
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
