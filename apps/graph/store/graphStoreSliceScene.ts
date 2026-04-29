import { applySceneCommand } from "@/lib/scene/applyCommand";
import { createInitialSceneDocument } from "./graphStoreObjectFactory";
import { resolveSelectedObjectId } from "./graphStoreSelection";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";
import { createDefaultViewport2D } from "./graphStoreViewportInit";

export function buildSceneSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "replaceSceneDocument" | "resetScene"
> {
  return {
    replaceSceneDocument: (sceneDocument) => {
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
            ...state.ui,
            selectedObjectId: resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects),
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

      set((state) => ({
        scene: applySceneCommand(state.scene, {
          type: "REPLACE_SCENE",
          payload: {
            scene: defaultScene
          }
        }),
        ui: {
          ...state.ui,
          selectedObjectId: defaultScene.objects[0]?.id ?? null,
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
