import type { GraphUiState, ScalarVizConfig } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import {
  clearAllAnalysisAndVectorCalculus,
  clearAnalysisAndVectorCalculus
} from "./graphStoreSliceAnalysis";
import { clearAllStreamlines, pruneStreamlineForSourceId } from "./graphStoreSliceStreamline";
import { DEFAULT_SCALAR_GRADIENT_DENSITY } from "@/lib/math/computeScalarFieldData";
import { DEFAULT_CONTOUR_COUNT } from "@/lib/math/marchingSquares";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

// S23 scalar-visualization config state: transient, source-attached,
// Inspector-driven. Lives in graphStore.ui (never in scene → no history
// pollution, no persistence, no serialization), following the S21/S22
// focused-slice pattern (not a new store). Computed grids live in the
// scalar-result cache, keyed separately; this map holds toggles and
// numeric settings only.

export const DEFAULT_SCALAR_VIZ_CONTOUR_COUNT = DEFAULT_CONTOUR_COUNT;
const DEFAULT_GRADIENT_SCALE = 1;
const DEFAULT_GRADIENT_NORMALIZE = false;

// Math-only source identity for scalar-viz configs. Covers the scalar
// mathematics only: kind, id, orientation, equation, domain, and sorted
// parameter KEYS. Deliberately excludes object resolution (scalar grids
// use fixed internal resolutions), color, wireframe, visibility, and
// parameter VALUES (value changes recompute in place, S22 PART 9 style).
// Returns null for non-scalar kinds (only explicit surfaces and implicit
// surfaces are scalar sources; vector fields are never scalar fields).
export function scalarVizMathIdentity(object: GraphObject, paramKeys?: string[]): string | null {
  if (object.kind !== "surface" && object.kind !== "implicitSurface") {
    return null;
  }
  const keys = [...(paramKeys ?? [])].sort().join(",");
  const domainSig = JSON.stringify(object.domain);
  if (object.kind === "surface") {
    return `scalarViz|surface|${object.id}|${object.orientation ?? "z"}|${object.equation}|${domainSig}|${keys}`;
  }
  return `scalarViz|implicitSurface|${object.id}|${object.equation}|${domainSig}|${keys}`;
}

function defaultScalarVizConfig(sourceId: string, structure: string): ScalarVizConfig {
  return {
    sourceId,
    structure,
    showHeatmap: false,
    showContours: false,
    contourCount: DEFAULT_SCALAR_VIZ_CONTOUR_COUNT,
    showGradient: false,
    gradientDensity: DEFAULT_SCALAR_GRADIENT_DENSITY,
    gradientScale: DEFAULT_GRADIENT_SCALE,
    gradientNormalize: DEFAULT_GRADIENT_NORMALIZE,
    sliceEnabled: false,
    slicePlane: "xy",
    sliceValue: 0,
    showSliceHeatmap: true,
    showSliceContours: true
  };
}

// Drops the scalar-viz config for one source id. Same-ref no-op when
// absent (keeps render-only edits cheap for subscribers).
export function pruneScalarVizForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.scalarVizBySourceId[sourceId]) {
    return ui;
  }
  const nextRecords = { ...ui.scalarVizBySourceId };
  delete nextRecords[sourceId];
  return { ...ui, scalarVizBySourceId: nextRecords };
}

export function clearAllScalarViz(ui: GraphUiState): GraphUiState {
  if (Object.keys(ui.scalarVizBySourceId).length === 0) {
    return ui;
  }
  return { ...ui, scalarVizBySourceId: {} };
}

// Combined lifecycle helpers: every S21/S22 analysis record plus the S23
// scalar-viz and S24 streamline configs for one source (delete/
// kind-switch) or everything (scene replace/reset). Result-cache pruning
// lives beside the callers in the results stores (zero imports needed
// here).
export function clearAllDerivedForSource(ui: GraphUiState, sourceId: string): GraphUiState {
  return pruneStreamlineForSourceId(
    pruneScalarVizForSourceId(clearAnalysisAndVectorCalculus(ui, sourceId), sourceId),
    sourceId
  );
}

export function clearAllDerived(ui: GraphUiState): GraphUiState {
  return clearAllStreamlines(clearAllScalarViz(clearAllAnalysisAndVectorCalculus(ui)));
}

export function buildScalarVizSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "setScalarVizConfig" | "clearScalarViz"
> {
  return {
    setScalarVizConfig: (sourceId, patch, structure) => {
      set((state) => ({
        ui: {
          ...state.ui,
          scalarVizBySourceId: {
            ...state.ui.scalarVizBySourceId,
            [sourceId]: {
              ...defaultScalarVizConfig(sourceId, structure),
              ...state.ui.scalarVizBySourceId[sourceId],
              ...patch,
              sourceId,
              structure
            }
          }
        }
      }));
    },

    clearScalarViz: (sourceId) => {
      set((state) => {
        if (sourceId) {
          const nextUi = pruneScalarVizForSourceId(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        const nextUi = clearAllScalarViz(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    }
  };
}
