import { serializeScene } from "@/lib/scene/serializeScene";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildUiDialogModeSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "openSceneDialog"
  | "closeSceneDialog"
  | "setSceneDialogDraft"
  | "setSceneDialogError"
  | "requestCameraReset"
  | "setGraphMode"
  | "setAxis2DPair"
  | "setActive2dViewport"
> {
  return {
    openSceneDialog: (mode) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sceneDialog: {
            isOpen: true,
            mode,
            jsonText:
              mode === "export"
                ? serializeScene(state.scene)
                : state.ui.sceneDialog.mode === "import" || mode === "import"
                  ? state.ui.sceneDialog.jsonText
                  : "",
            error: null
          }
        }
      }));
    },

    closeSceneDialog: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          sceneDialog: {
            ...state.ui.sceneDialog,
            isOpen: false,
            error: null
          }
        }
      }));
    },

    setSceneDialogDraft: (jsonText) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sceneDialog: {
            ...state.ui.sceneDialog,
            jsonText
          }
        }
      }));
    },

    setSceneDialogError: (error) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sceneDialog: {
            ...state.ui.sceneDialog,
            error
          }
        }
      }));
    },

    requestCameraReset: () => {
      set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 }));
    },

    setGraphMode: (mode) => {
      set((state) => {
        if (state.ui.graphMode === mode) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            graphMode: mode,
            ...(mode === "3d"
              ? {
                  canvas2dTool: "pan" as const,
                  probePins: []
                }
              : {
                  canvas3dTool: "pan" as const,
                  probePins: []
                })
          },
          cameraResetVersion: mode === "3d" ? state.cameraResetVersion + 1 : state.cameraResetVersion
        };
      });
    },

    setAxis2DPair: (pair) => {
      set((state) => {
        if (state.ui.active2dViewport === "quadTop") {
          return {
            ui: {
              ...state.ui,
              axis2dPairQuadTop: pair
            }
          };
        }

        return {
          ui: {
            ...state.ui,
            axis2dPair: pair
          }
        };
      });
    },

    setActive2dViewport: (slot) => {
      set((state) => {
        if (state.ui.active2dViewport === slot) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            active2dViewport: slot
          }
        };
      });
    }
  };
}
