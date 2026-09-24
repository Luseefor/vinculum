import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { findObjectById } from "./graphStoreSelection";
import { updateImplicitSurfaceField } from "./graphStoreImplicitSurfaceField";
import { updateParametricCurveField } from "./graphStoreParametricField";
import { updateParametricSurfaceField } from "./graphStoreParametricSurfaceField";
import { updateVectorFieldField } from "./graphStoreVectorFieldField";
import { pruneAnalysisForSourceId, pruneVectorCalculusForSourceId } from "./graphStoreSliceAnalysis";
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
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
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
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
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
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
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
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
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
          scene: applySceneCommand(state.scene, command),
          // S21: any object-math commit invalidates attached analysis for
          // that source (no-ops via same-ref when nothing is attached).
          ui: pruneAnalysisForSourceId(state.ui, id)
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
        return {
          scene: applySceneCommand(state.scene, command),
          ui: mathFields.has(field) ? pruneVectorCalculusForSourceId(state.ui, id) : state.ui
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
