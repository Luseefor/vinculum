import { useEditorStore } from "@/lib/store/editorStore";
import { captureSceneParameters } from "@/lib/scene/sceneParameters";
import { isRestoringSceneParameters, restoreSceneParameters } from "@/lib/store/sceneParameterSync";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mergePersistedGraphStore } from "./graphStoreMerge";
import { createInitialSceneDocument } from "./graphStoreObjectFactory";
import { buildAnalysisSlice } from "./graphStoreSliceAnalysis";
import { buildGeometryAnalysisSlice } from "./graphStoreSliceGeometryAnalysis";
import { buildLinearTransformSlice } from "./graphStoreSliceLinearTransform";
import { buildIntegralSlice } from "./graphStoreSliceIntegral";
import { buildScalarVizSlice } from "./graphStoreSliceScalarViz";
import { buildStreamlineSlice } from "./graphStoreSliceStreamline";
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
let hydratingParameters = false;

function createGraphSessionStorage() {
  const storage = createJSONStorage<Pick<GraphStoreState, "scene" | "ui">>(() => sessionStorage);
  if (!storage) return undefined;
  let warned = false;
  const warn = () => {
    if (warned) return;
    warned = true;
    console.warn("Session storage is unavailable or invalid; continuing with the in-memory scene.");
  };
  // Web Storage is synchronous. Catch reads and JSON parsing here so Zustand
  // completes hydration and releases the shell's recovery/autosave startup gate.
  return {
    getItem: (name: string) => {
      try { return storage.getItem(name); }
      catch { warn(); return null; }
    },
    setItem: (...args: Parameters<typeof storage.setItem>) => {
      try { return storage.setItem(...args); }
      catch { warn(); }
    },
    removeItem: (name: string) => {
      try { return storage.removeItem(name); }
      catch { warn(); }
    }
  };
}

export const useGraphStore = create<GraphStoreState>()(
  persist(
    (set) => ({
      scene: initialScene,
      ui: createInitialUiState(initialScene.objects[0]?.id ?? null),
      cameraResetVersion: 0,
      ...buildAnalysisSlice(set),
      ...buildGeometryAnalysisSlice(set),
      ...buildLinearTransformSlice(set),
      ...buildIntegralSlice(set),
      ...buildScalarVizSlice(set),
      ...buildStreamlineSlice(set),
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
      storage: createGraphSessionStorage(),
      onRehydrateStorage: () => (state) => {
        // Failed reads/JSON parsing do not fire onFinishHydration. Resume
        // portable parameter snapshots for the in-memory editor as well.
        if (!state) hydratingParameters = false;
      },
      partialize: (state) => ({
        scene: state.scene,
        ui: {
          ...state.ui,
          // Transient interaction requests never persist across sessions.
          focusEquationForObjectId: null,
          // S21: differential analysis is probe-like inspection state.
          // The point, captured structure, and arming never persist;
          // derivatives recompute live after reload when still valid.
          differentialAnalysisBySourceId: {},
          differentialAnalysisPickArmedId: null,
          // S22: vector-calculus records and directional inputs are
          // equally transient (recomputed live, never serialized).
          vectorCalculusBySourceId: {},
          directionInputBySourceId: {},
          // S23: scalar-visualization configs are toggles only (grids
          // live in the result cache); equally transient.
          scalarVizBySourceId: {},
          // S24: streamline configs are toggles only (polylines live in
          // the result cache); equally transient.
          streamlineVizBySourceId: {},
          // S25: integral-analysis configs are inputs only (numbers live
          // in the result cache); equally transient.
          integralAnalysisBySourceId: {},
          // S27: geometry-analysis records are selection pairs only
          // (facts recompute live); equally transient.
          geometryAnalysisBySourceId: {},
          // S28: linearTransform analysis (vector selection + overlay
          // toggles) is transient UI; facts recompute live.
          linearTransformAnalysisBySourceId: {},
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

// Runtime values remain editor-owned; the scene carries their portable snapshot.
const captureParameters = () => {
  if (hydratingParameters || isRestoringSceneParameters()) return;
  const graph = useGraphStore.getState();
  graph.setSceneParameters(captureSceneParameters(graph.scene.objects, useEditorStore.getState().parameters));
};
useEditorStore.subscribe((state, previous) => {
  if (state.parameters !== previous.parameters) captureParameters();
});
useGraphStore.subscribe((state, previous) => {
  if (state.scene.objects !== previous.scene.objects) captureParameters();
});
// Zustand omits the persistence API when Web Storage cannot be obtained.
// Scene/parameter subscriptions must still work for the in-memory editor.
useGraphStore.persist?.onHydrate(() => { hydratingParameters = true; });
useGraphStore.persist?.onFinishHydration(state => {
  // A fresh editor has no saved scope to restore; retain its existing
  // defaults. A recovered session replaces those defaults with its snapshot.
  if (state.scene !== initialScene) restoreSceneParameters(state.scene.parameters, () => {});
  hydratingParameters = false;
});
