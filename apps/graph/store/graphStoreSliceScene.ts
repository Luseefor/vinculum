import { applySceneCommand } from "@/lib/scene/applyCommand";
import { createInitialSceneDocument } from "./graphStoreObjectFactory";
import { resolveSelectedObjectId } from "./graphStoreSelection";
import { clearAllDerived } from "./graphStoreSliceScalarViz";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";
import { createDefaultViewport2D } from "./graphStoreViewportInit";

export function buildSceneSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "replaceSceneDocument" | "resetScene"
> {
  return {
    replaceSceneDocument: (sceneDocument) => {
      // S23: scene replacement drops every cached scalar grid.
      // S24: same for cached streamlines. S25: same for integral results.
      useScalarVizResultsStore.getState().clearAll();
      useStreamlineResultsStore.getState().clearAll();
      useIntegralResultsStore.getState().clearAll();
      set((state) => {
        const nextScene = applySceneCommand(state.scene, {
          type: "REPLACE_SCENE",
          payload: {
            scene: sceneDocument
          }
        });

        return {
          scene: nextScene,
          ui: {
            ...clearAllDerived(state.ui),
            selectedObjectId: resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects),
            selectedMeasurementId:
              state.ui.selectedMeasurementId &&
              nextScene.measurements.some((measurement) => measurement.id === state.ui.selectedMeasurementId)
                ? state.ui.selectedMeasurementId
                : null,
            focusEquationForObjectId: null,
            measurementDraft: null,
            probePins: nextScene.measurements
              .filter((measurement) => measurement.kind === "pin")
              .map((measurement, index) => ({
                id: measurement.id,
                color: PROBE_PIN_COLORS[index % PROBE_PIN_COLORS.length] ?? "#f472b6",
                world: measurement.point
              })),
            sceneDialog: {
              ...state.ui.sceneDialog,
              isOpen: false,
              error: null
            }
          }
        };
      });
    },

    resetScene: () => {
      const defaultScene = createInitialSceneDocument();
      // S23: scene reset drops every cached scalar grid.
      // S24: same for cached streamlines. S25: same for integral results.
      useScalarVizResultsStore.getState().clearAll();
      useStreamlineResultsStore.getState().clearAll();
      useIntegralResultsStore.getState().clearAll();

      set((state) => ({
        scene: applySceneCommand(state.scene, {
          type: "REPLACE_SCENE",
          payload: {
            scene: defaultScene
          }
        }),
        ui: {
          ...clearAllDerived(state.ui),
          selectedObjectId: defaultScene.objects[0]?.id ?? null,
          selectedMeasurementId: null,
          focusEquationForObjectId: null,
          canvas2dTool: "pan",
          canvas3dTool: "pan",
          baseline3dPlane: "xy",
          measurementDraft: null,
          probePins: [],
          sketchExtendFraction: 0.15,
          sketchAutoCreate: true,
          snapEnabled: true,
          snapStep: 0.25,
          density: state.ui.density,
          sceneDialog: {
            ...state.ui.sceneDialog,
            isOpen: false,
            error: null,
            jsonText: ""
          },
          projectSession: {
            currentProjectId: null,
            currentProjectName: null,
            autosaveStatus: "idle",
            autosaveError: null
          },
          active2dViewport: "primary",
          axis2dPairQuadTop: "xz",
          viewport2d: createDefaultViewport2D(),
          viewport2dFrame: {
            width: 0,
            height: 0
          },
          viewport2dQuadTop: createDefaultViewport2D(),
          viewport2dQuadTopFrame: {
            width: 0,
            height: 0
          }
        },
        cameraResetVersion: state.cameraResetVersion + 1
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
