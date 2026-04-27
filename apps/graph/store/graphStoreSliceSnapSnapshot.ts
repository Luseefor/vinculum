import { resolveSelectedObjectId } from "./graphStoreSelection";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildSnapSnapshotSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "setSketchExtendFraction"
  | "setSketchAutoCreate"
  | "setSnapEnabled"
  | "setSnapStep"
  | "applySceneSnapshot"
> {
  return {
    setSketchExtendFraction: (fraction) => {
      if (!Number.isFinite(fraction)) {
        return;
      }

      const clamped = Math.min(0.45, Math.max(0, fraction));
      set((state) => ({
        ui: {
          ...state.ui,
          sketchExtendFraction: clamped
        }
      }));
    },

    setSketchAutoCreate: (enabled) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sketchAutoCreate: enabled
        }
      }));
    },

    setSnapEnabled: (enabled) => {
      set((state) => ({
        ui: {
          ...state.ui,
          snapEnabled: enabled
        }
      }));
    },

    setSnapStep: (step) => {
      if (!Number.isFinite(step)) {
        return;
      }
      set((state) => ({
        ui: {
          ...state.ui,
          snapStep: Math.min(100, Math.max(0.0001, step))
        }
      }));
    },

    applySceneSnapshot: (snapshot) => {
      set((state) => ({
        scene: {
          ...state.scene,
          objects: snapshot.objects
        },
        ui: {
          ...state.ui,
          selectedObjectId: resolveSelectedObjectId(snapshot.selection.selectedObjectId, snapshot.objects)
        }
      }));
    }
  };
}
