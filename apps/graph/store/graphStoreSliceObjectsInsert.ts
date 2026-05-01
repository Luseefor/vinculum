import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { appendObject } from "./graphStoreAppendObject";
import {
  createEmptyGraphObject,
  createGraphObject,
  isGraphObjectWithoutExpressions
} from "./graphStoreObjectFactory";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceInsert(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "addSurfaceObject"
  | "addParametricCurve"
  | "addPlaneObject"
  | "addEmptyObject"
  | "insertObjectAfter"
  | "setObjectKind"
> {
  return {
    addSurfaceObject: () => {
      return appendObject(set, (index) => createSurfaceGraph({ colorIndex: index }));
    },

    addParametricCurve: () => {
      return appendObject(set, (index) => createParametricCurve({ colorIndex: index }));
    },

    addPlaneObject: () => {
      return appendObject(set, (index) => createPlaneGraph({ colorIndex: index }));
    },

    addEmptyObject: () => {
      return appendObject(set, (index) => createSurfaceGraph({ colorIndex: index, equation: "" }));
    },

    insertObjectAfter: (id, kind) => {
      let createdObjectId = "";

      set((state) => {
        const nextObject = createGraphObject(kind, state.scene.objects.length);
        createdObjectId = nextObject.id;

        const insertIndex = state.scene.objects.findIndex((object) => object.id === id);
        const command: SceneCommand = {
          type: "ADD_OBJECT",
          payload: {
            object: nextObject,
            index: insertIndex === -1 ? state.scene.objects.length : insertIndex + 1
          }
        };

        const nextScene = applySceneCommand(state.scene, command);

        return {
          scene: nextScene,
          ui: {
            ...state.ui,
            selectedObjectId: nextObject.id
          }
        };
      });

      return createdObjectId;
    },

    setObjectKind: (id, kind) => {
      set((state) => {
        const index = state.scene.objects.findIndex((object) => object.id === id);
        if (index === -1) {
          return state;
        }

        const currentObject = state.scene.objects[index];
        if (currentObject.kind === kind) {
          return state;
        }

        const replacement = isGraphObjectWithoutExpressions(currentObject)
          ? createEmptyGraphObject(kind, index, {
              id: currentObject.id,
              color: currentObject.color,
              visible: currentObject.visible
            })
          : createGraphObject(kind, index, {
              id: currentObject.id,
              color: currentObject.color,
              visible: currentObject.visible
            });

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: replacement
          }
        };

        return {
          scene: applySceneCommand(state.scene, command)
        };
      });
    }
  };
}
