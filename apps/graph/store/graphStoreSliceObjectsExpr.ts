import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { findObjectById } from "./graphStoreSelection";
import { updateImplicitSurfaceField } from "./graphStoreImplicitSurfaceField";
import { updateParametricCurveField } from "./graphStoreParametricField";
import { updateParametricSurfaceField } from "./graphStoreParametricSurfaceField";
import { updateVectorFieldField } from "./graphStoreVectorFieldField";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceExpr(set: GraphStoreSet): Pick<
  GraphStoreState,
  "updateSurfaceEquation" | "updateSurfaceOrientation" | "updateParametricExpression" | "updateParametricSurfaceExpression" | "updateImplicitSurfaceExpression" | "updateVectorFieldExpression" | "updatePlaneEquation"
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

    updateParametricSurfaceExpression: (id, field, value) => {
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
          scene: applySceneCommand(state.scene, command)
        };
      });
    },

    updateImplicitSurfaceExpression: (id, field, value) => {
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

        return {
          scene: applySceneCommand(state.scene, command)
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
