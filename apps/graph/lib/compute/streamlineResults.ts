import { create } from "zustand";
import type { StreamlineComputeOkResult } from "./geometryComputeProtocol";

// S24 transient streamline-result cache (S23 scalarVizResults pattern).
// Worker responses land here keyed `streamline:<sourceId>`: packed
// polylines + offsets + closed flags. Never persisted, never serialized,
// never in history — TypedArrays stay out of persisted Zustand (PART 55
// React-review rule). Renderers recolor cached lines on source-color
// changes with zero worker jobs.

export type StreamlineResultBody = StreamlineComputeOkResult | { status: "empty" };

export interface StreamlineResultEntry {
  /** Job signature the result was computed for (structure + numerics). */
  signature: string;
  result: StreamlineResultBody;
}

interface StreamlineResultsState {
  entries: Record<string, StreamlineResultEntry>;
  setResult: (key: string, entry: StreamlineResultEntry) => void;
  removeForSource: (sourceId: string) => void;
  clearAll: () => void;
}

export const STREAMLINE_RESULT_PREFIX = "streamline:";

export function streamlineResultKey(sourceId: string): string {
  return `${STREAMLINE_RESULT_PREFIX}${sourceId}`;
}

export const useStreamlineResultsStore = create<StreamlineResultsState>()((set) => ({
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
      const key = streamlineResultKey(sourceId);
      if (!state.entries[key]) {
        return state;
      }
      const entries = { ...state.entries };
      delete entries[key];
      return { entries };
    });
  },
  clearAll: () => {
    set((state) => (Object.keys(state.entries).length === 0 ? state : { entries: {} }));
  }
}));
