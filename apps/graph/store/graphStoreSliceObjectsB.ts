import { applySceneCommand } from "@/lib/scene/applyCommand";
import { findObjectById, resolveSelectedObjectId } from "./graphStoreSelection";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceB(set: GraphStoreSet): Pick<
  GraphStoreState,
  "toggleObjectVisibility" | "setObjectVisibility" | "selectObject" | "removeObject"
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

        return {
          ui: {
            ...state.ui,
            selectedObjectId: id
          }
        };
      });
    },

    removeObject: (id) => {
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
            ...state.ui,
            selectedObjectId: nextSelectedObjectId
          }
        };
      });
    }
  };
}
