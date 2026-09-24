import { create } from "zustand";
import type { ScalarFieldComputeOkResult } from "./geometryComputeProtocol";

// S23 transient scalar-result cache. Worker responses land here (never in
// the scene, never persisted, never serialized): raw values + validity +
// contours + gradients, keyed by namespaced job id (`scalar:<sourceId>` /
// `slice:<sourceId>`). Renderers recolor cached grids per theme with zero
// worker jobs; TypedArrays never enter persisted Zustand (PART 55) because
// this store has no persist middleware at all.

export type ScalarVizResultBody = ScalarFieldComputeOkResult | { status: "empty" };

export interface ScalarVizResultEntry {
  /** Job signature the result was computed for (structure + numerics). */
  signature: string;
  result: ScalarVizResultBody;
}

interface ScalarVizResultsState {
  entries: Record<string, ScalarVizResultEntry>;
  setResult: (key: string, entry: ScalarVizResultEntry) => void;
  removeForSource: (sourceId: string) => void;
  clearAll: () => void;
}

export const SCALAR_VIZ_FIELD_PREFIX = "scalar:";
export const SCALAR_VIZ_SLICE_PREFIX = "slice:";

export function scalarVizFieldKey(sourceId: string): string {
  return `${SCALAR_VIZ_FIELD_PREFIX}${sourceId}`;
}

export function scalarVizSliceKey(sourceId: string): string {
  return `${SCALAR_VIZ_SLICE_PREFIX}${sourceId}`;
}

export const useScalarVizResultsStore = create<ScalarVizResultsState>()((set) => ({
  entries: {},
  setResult: (key, entry) => {
    set((state) => {
      const current = state.entries[key];
      if (current === entry || (current && current.signature === entry.signature && current.result === entry.result)) {
        return state;
      }
      return { entries: { ...state.entries, [key]: entry } };
    });
  },
  removeForSource: (sourceId) => {
    set((state) => {
      const fieldKey = scalarVizFieldKey(sourceId);
      const sliceKey = scalarVizSliceKey(sourceId);
      if (!state.entries[fieldKey] && !state.entries[sliceKey]) {
        return state;
      }
      const entries = { ...state.entries };
      delete entries[fieldKey];
      delete entries[sliceKey];
      return { entries };
    });
  },
  clearAll: () => {
    set((state) => (Object.keys(state.entries).length === 0 ? state : { entries: {} }));
  }
}));
