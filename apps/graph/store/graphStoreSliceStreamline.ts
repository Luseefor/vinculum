import type { GraphUiState, StreamlineVizConfig } from "@/types/graphUi";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

// S24 streamline-viz config state: transient, source-attached,
// Inspector-driven. Lives in graphStore.ui (never in scene → no history
// pollution, no persistence, no serialization), following the S22/S23
// focused-slice pattern (not a new store). Computed polylines live in the
// streamline-result cache; this map holds toggles and numeric settings
// only. Source identity reuses vectorCalculusSourceIdentity (kind, id,
// dimension, P/Q/R, domain, param keys) — exactly the streamline
// mathematics (PART: structure depends on dimension/exprs/domain/params,
// never on glyph density/scale/normalize/color/visibility).

// Drops the streamline config for one source id. Same-ref no-op when
// absent (keeps render-only edits cheap for subscribers).
export function pruneStreamlineForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.streamlineVizBySourceId[sourceId]) {
    return ui;
  }
  const nextRecords = { ...ui.streamlineVizBySourceId };
  delete nextRecords[sourceId];
  return { ...ui, streamlineVizBySourceId: nextRecords };
}

export function clearAllStreamlines(ui: GraphUiState): GraphUiState {
  if (Object.keys(ui.streamlineVizBySourceId).length === 0) {
    return ui;
  }
  return { ...ui, streamlineVizBySourceId: {} };
}

export function buildStreamlineSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "setStreamlineConfig" | "clearStreamline"
> {
  return {
    setStreamlineConfig: (sourceId, patch, structure) => {
      set((state) => {
        const current = state.ui.streamlineVizBySourceId[sourceId];
        const dimension = current?.dimension ?? patch.dimension ?? "2d";
        const next: StreamlineVizConfig = {
          sourceId,
          structure,
          enabled: patch.enabled ?? current?.enabled ?? false,
          seedDensity: patch.seedDensity ?? current?.seedDensity ?? (dimension === "2d" ? 6 : 3),
          length: patch.length ?? current?.length ?? "medium",
          quality: patch.quality ?? current?.quality ?? "medium",
          dimension
        };
        // S24-R1: same-value commits (e.g. re-selecting the active length)
        // keep the ref so subscribers skip re-render and effects skip work.
        if (
          current &&
          current.sourceId === next.sourceId &&
          current.structure === next.structure &&
          current.dimension === next.dimension &&
          current.enabled === next.enabled &&
          current.seedDensity === next.seedDensity &&
          current.length === next.length &&
          current.quality === next.quality
        ) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            streamlineVizBySourceId: {
              ...state.ui.streamlineVizBySourceId,
              [sourceId]: next
            }
          }
        };
      });
    },

    clearStreamline: (sourceId) => {
      set((state) => {
        if (sourceId) {
          const nextUi = pruneStreamlineForSourceId(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        const nextUi = clearAllStreamlines(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    }
  };
}
