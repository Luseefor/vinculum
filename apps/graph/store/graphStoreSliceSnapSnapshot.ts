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
          objects: snapshot.objects,
          measurements: snapshot.measurements
        },
        ui: {
          ...state.ui,
          probePins: snapshot.measurements
            .filter((measurement) => measurement.kind === "pin")
            .map((measurement, index) => ({
              id: measurement.id,
              color: PROBE_PIN_COLORS[index % PROBE_PIN_COLORS.length] ?? "#f472b6",
              world: measurement.point
            })),
          measurementDraft: null,
          selectedObjectId: resolveSelectedObjectId(snapshot.selection.selectedObjectId, snapshot.objects),
          selectedMeasurementId: null
        }
      }));
    }
  };
}

const PROBE_PIN_COLORS = [
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#34d399",
  "#60a5fa"
] as const;
