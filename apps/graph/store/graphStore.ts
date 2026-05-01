import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mergePersistedGraphStore } from "./graphStoreMerge";
import { createInitialSceneDocument } from "./graphStoreObjectFactory";
import { buildObjectsSliceB } from "./graphStoreSliceObjectsB";
import { buildObjectsSliceExpr } from "./graphStoreSliceObjectsExpr";
import { buildObjectsSliceInsert } from "./graphStoreSliceObjectsInsert";
import { buildObjectsSliceC } from "./graphStoreSliceObjectsC";
import { buildSceneSlice } from "./graphStoreSliceScene";
import { buildSketchStrokesSlice } from "./graphStoreSliceSketchStrokes";
import { buildSnapSnapshotSlice } from "./graphStoreSliceSnapSnapshot";
import { buildThemeDensitySlice } from "./graphStoreSliceThemeDensity";
import { buildToolsProbesSlice } from "./graphStoreSliceToolsProbes";
import { buildUiDialogModeSlice } from "./graphStoreSliceUiDialogMode";
import { buildViewport2dSlice } from "./graphStoreSliceViewport2d";
import type { GraphStoreState } from "./graphStoreTypes";
import { createInitialUiState } from "./graphStoreViewportInit";

export type { GraphStoreState } from "./graphStoreTypes";
export {
  isParametricCurveObject,
  isPlaneGraphObject,
  isSurfaceGraphObject
} from "./graphStoreGuards";

const initialScene = createInitialSceneDocument();

export const useGraphStore = create<GraphStoreState>()(
  persist(
    (set) => ({
      scene: initialScene,
      ui: createInitialUiState(initialScene.objects[0]?.id ?? null),
      cameraResetVersion: 0,
      ...buildObjectsSliceInsert(set),
      ...buildObjectsSliceExpr(set),
      ...buildObjectsSliceB(set),
      ...buildObjectsSliceC(set),
      ...buildSceneSlice(set),
      ...buildUiDialogModeSlice(set),
      ...buildThemeDensitySlice(set),
      ...buildViewport2dSlice(set),
      ...buildToolsProbesSlice(set),
      ...buildSnapSnapshotSlice(set),
      ...buildSketchStrokesSlice(set)
    }),
    {
      name: "vinculum-graph-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        scene: state.scene,
        ui: {
          ...state.ui,
          sceneDialog: {
            isOpen: false,
            mode: state.ui.sceneDialog.mode,
            jsonText: "",
            error: null
          }
        }
      }),
      merge: mergePersistedGraphStore,
      skipHydration: true
    }
  )
);
