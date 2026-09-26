// S28 transient linearTransform analysis records keyed by transform id:
// referenced Vector id plus overlay toggles. Computed facts (Av,
// eigenpairs, properties) live nowhere — Inspector and overlays
// recompute synchronously from live sources every render, so parameter
// edits, undo/redo, and workspace switches never show stale math. Never
// serialized; no history entries for analysis UI (PART 37/69).

import type { GraphUiState, LinearTransformAnalysisConfig } from "@/types/graphUi";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function pruneLinearTransformAnalysisForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  let changed = false;
  const nextRecords: Record<string, LinearTransformAnalysisConfig> = {};
  for (const [transformId, config] of Object.entries(ui.linearTransformAnalysisBySourceId)) {
    // Drop the transform's own analysis and any analysis referencing
    // the deleted/converted source as its vector (PART 68).
    if (transformId === sourceId || config.vectorId === sourceId) {
      changed = true;
      continue;
    }
    nextRecords[transformId] = config;
  }
  if (!changed) {
    return ui;
  }
  return { ...ui, linearTransformAnalysisBySourceId: nextRecords };
}

/** Primary-only delete for per-analysis clears (third-party references intact). */
export function deleteLinearTransformAnalysisForPrimary(ui: GraphUiState, transformId: string): GraphUiState {
  if (!ui.linearTransformAnalysisBySourceId[transformId]) {
    return ui;
  }
  const nextRecords = { ...ui.linearTransformAnalysisBySourceId };
  delete nextRecords[transformId];
  return { ...ui, linearTransformAnalysisBySourceId: nextRecords };
}

export function clearAllLinearTransformAnalysis(ui: GraphUiState): GraphUiState {
  if (Object.keys(ui.linearTransformAnalysisBySourceId).length === 0) {
    return ui;
  }
  return { ...ui, linearTransformAnalysisBySourceId: {} };
}

export function buildLinearTransformSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "setLinearTransformAnalysis" | "clearLinearTransformAnalysis"
> {
  return {
    setLinearTransformAnalysis: (transformId, patch) => {
      set((state) => {
        const current = state.ui.linearTransformAnalysisBySourceId[transformId];
        const next: LinearTransformAnalysisConfig = {
          vectorId: patch.vectorId !== undefined ? patch.vectorId : (current?.vectorId ?? null),
          showVector: patch.showVector ?? current?.showVector ?? false,
          showEigen: patch.showEigen ?? current?.showEigen ?? false
        };
        const prev = state.ui.linearTransformAnalysisBySourceId[transformId];
        if (
          prev &&
          prev.vectorId === next.vectorId &&
          prev.showVector === next.showVector &&
          prev.showEigen === next.showEigen
        ) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            linearTransformAnalysisBySourceId: {
              ...state.ui.linearTransformAnalysisBySourceId,
              [transformId]: next
            }
          }
        };
      });
    },

    clearLinearTransformAnalysis: (transformId) => {
      set((state) => {
        if (transformId) {
          const nextRecords = { ...state.ui.linearTransformAnalysisBySourceId };
          if (!nextRecords[transformId]) {
            return state;
          }
          delete nextRecords[transformId];
          return { ui: { ...state.ui, linearTransformAnalysisBySourceId: nextRecords } };
        }
        const nextUi = clearAllLinearTransformAnalysis(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    }
  };
}
