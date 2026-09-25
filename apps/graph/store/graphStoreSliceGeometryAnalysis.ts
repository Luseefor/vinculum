// S27 transient geometry-analysis records keyed by PRIMARY source id.
// One secondary per primary (single selection); computed facts live
// nowhere — Inspector and overlays recompute synchronously from live
// sources each render/tick, so parameter edits, undo/redo, and
// workspace switches can never show stale math. Never serialized;
// no history entries for analysis UI.

import type { GraphUiState, GeometryAnalysisConfig } from "@/types/graphUi";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function defaultGeometryAnalysis(primaryId: string, secondaryId: string): GeometryAnalysisConfig {
  return { secondaryId, showOverlay: false };
}

export function pruneGeometryAnalysisForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  let changed = false;
  const nextRecords: Record<string, GeometryAnalysisConfig> = {};
  for (const [primaryId, config] of Object.entries(ui.geometryAnalysisBySourceId)) {
    // Drop the primary's own analysis and any analysis referencing the
    // deleted/converted source as secondary (PART 32).
    if (primaryId === sourceId || config.secondaryId === sourceId) {
      changed = true;
      continue;
    }
    nextRecords[primaryId] = config;
  }
  if (!changed) {
    return ui;
  }
  return { ...ui, geometryAnalysisBySourceId: nextRecords };
}

/** Primary-only delete: removes one analysis without touching other
 *  primaries that reference the same id as secondary. Used by
 *  per-analysis clears and tick GC, where the id is only known to be a
 *  stale primary (clearing C→A when pruning A would be wrong). */
export function deleteGeometryAnalysisForPrimary(ui: GraphUiState, primaryId: string): GraphUiState {
  if (!ui.geometryAnalysisBySourceId[primaryId]) {
    return ui;
  }
  const nextRecords = { ...ui.geometryAnalysisBySourceId };
  delete nextRecords[primaryId];
  return { ...ui, geometryAnalysisBySourceId: nextRecords };
}

export function clearAllGeometryAnalysis(ui: GraphUiState): GraphUiState {
  if (Object.keys(ui.geometryAnalysisBySourceId).length === 0) {
    return ui;
  }
  return { ...ui, geometryAnalysisBySourceId: {} };
}

export function geometryAnalysisSourcesReferencing(ui: GraphUiState, secondaryId: string): string[] {
  const sources: string[] = [];
  for (const [primaryId, config] of Object.entries(ui.geometryAnalysisBySourceId)) {
    if (config.secondaryId === secondaryId) {
      sources.push(primaryId);
    }
  }
  return sources;
}

export function buildGeometryAnalysisSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "setGeometryAnalysis" | "clearGeometryAnalysis"
> {
  return {
    setGeometryAnalysis: (primaryId, patch) => {
      set((state) => {
        const current = state.ui.geometryAnalysisBySourceId[primaryId];
        const secondaryId = patch.secondaryId ?? current?.secondaryId ?? null;
        if (secondaryId === null) {
          return state;
        }
        // A new pair starts with the overlay off: each pair needs its own
        // explicit opt-in (PART 23), never an inherited toggle.
        const secondaryChanged = current !== undefined && current.secondaryId !== secondaryId;
        const next: GeometryAnalysisConfig = {
          secondaryId,
          showOverlay: secondaryChanged ? false : (patch.showOverlay ?? current?.showOverlay ?? false)
        };
        const prev = state.ui.geometryAnalysisBySourceId[primaryId];
        if (
          prev &&
          prev.secondaryId === next.secondaryId &&
          prev.showOverlay === next.showOverlay
        ) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            geometryAnalysisBySourceId: {
              ...state.ui.geometryAnalysisBySourceId,
              [primaryId]: next
            }
          }
        };
      });
    },

    clearGeometryAnalysis: (primaryId) => {
      set((state) => {
        if (primaryId) {
          // Primary-only: third-party pairs referencing this id as
          // secondary survive (their overlays GC independently).
          const nextRecords = { ...state.ui.geometryAnalysisBySourceId };
          if (!nextRecords[primaryId]) {
            return state;
          }
          delete nextRecords[primaryId];
          return { ui: { ...state.ui, geometryAnalysisBySourceId: nextRecords } };
        }
        const nextUi = clearAllGeometryAnalysis(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    }
  };
}
