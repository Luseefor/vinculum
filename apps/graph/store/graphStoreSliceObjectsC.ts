import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { normalizeSurfaceResolution } from "@vinculum/scene/defaults";
import { findObjectById } from "./graphStoreSelection";
import { pruneAnalysisForSourceId } from "./graphStoreSliceAnalysis";
import { pruneScalarVizForSourceId } from "./graphStoreSliceScalarViz";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { normalizeHexColor, sanitizePartialDomain } from "./graphStoreSanitize";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceC(set: GraphStoreSet): Pick<
  GraphStoreState,
  "updateObjectColor" | "updateSurfaceDomain" | "updateSurfaceResolution" | "toggleSurfaceWireframe"
> {
  return {
    updateObjectColor: (id, color) => {
      const safeColor = normalizeHexColor(color);
      if (!safeColor) {
        return;
      }

      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object) {
          return state;
        }
        if (object.color === safeColor) {
          return state;
        }

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: {
              ...object,
              color: safeColor
            }
          }
        };

        return {
          scene: applySceneCommand(state.scene, command)
        };
      });
    },

    updateSurfaceDomain: (id, partialDomain) => {
      const sanitizedDomain = sanitizePartialDomain(partialDomain);
      // S23: domain commits move the scalar grid (config pruned here).
      useScalarVizResultsStore.getState().removeForSource(id);
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
              domain: {
                ...object.domain,
                ...sanitizedDomain
              }
            }
          }
        };

        return {
          scene: applySceneCommand(state.scene, command),
          ui: pruneScalarVizForSourceId(pruneAnalysisForSourceId(state.ui, id), id)
        };
      });
    },

    updateSurfaceResolution: (id, resolution) => {
      if (!Number.isFinite(resolution)) {
        return;
      }

      const safeResolution = normalizeSurfaceResolution(resolution);

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
              resolution: safeResolution
            }
          }
        };

        // S23: object resolution never invalidates scalar viz (grids use
        // fixed internal resolutions), unlike the S21 mesh analysis below.
        return {
          scene: applySceneCommand(state.scene, command),
          ui: pruneAnalysisForSourceId(state.ui, id)
        };
      });
    },

    toggleSurfaceWireframe: (id) => {
      set((state) => {
        const object = findObjectById(state.scene.objects, id);
        if (!object) {
          return state;
        }

        if (object.kind === "surface" || object.kind === "parametricSurface" || object.kind === "implicitSurface") {
          // S21: wireframe is appearance-only (excluded from analysis
          // identity), so unlike domain/resolution it retains analysis.
          return {
            scene: applySceneCommand(state.scene, {
              type: "UPDATE_OBJECT",
              payload: {
                object: {
                  ...object,
                  appearance: {
                    ...object.appearance,
                    wireframe: !object.appearance.wireframe
                  }
                }
              }
            })
          };
        }

        if (object.kind === "plane") {
          return {
            scene: applySceneCommand(state.scene, {
              type: "UPDATE_OBJECT",
              payload: {
                object: {
                  ...object,
                  appearance: {
                    ...object.appearance,
                    wireframe: !object.appearance.wireframe
                  }
                }
              }
            })
          };
        }

        return state;
      });
    }
  };
}
