import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { findObjectById } from "./graphStoreSelection";
import { updateParametricCurveField } from "./graphStoreParametricField";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceExpr(set: GraphStoreSet): Pick<
  GraphStoreState,
  "updateSurfaceEquation" | "updateSurfaceOrientation" | "updateParametricExpression" | "updatePlaneEquation"
> {
  return {
    updateSurfaceEquation: (id, equation) => {
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
          scene: applySceneCommand(state.scene, command)
        };
      });
    },

    updateSurfaceOrientation: (id, orientation) => {
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
          scene: applySceneCommand(state.scene, command)
        };
      });
    },

    updateParametricExpression: (id, field, value) => {
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
          scene: applySceneCommand(state.scene, command)
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
          scene: applySceneCommand(state.scene, command)
        };
      });
    }
  };
}
