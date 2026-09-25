import { create } from "zustand";
import type { IntegralAnalysisNonOkResult, IntegralAnalysisOkResult } from "./geometryComputeProtocol";

// S25 transient integral-result cache (S23/S24 results-store pattern).
// Worker responses land here keyed `integral:<targetId>`: tiny structured
// numbers (value, coarse comparison, honest error estimate, evaluation
// count) plus a terminal status. Never persisted, never serialized,
// never in history. Renderers are uninvolved — the Inspector reads the
// cache directly (S22-Jacobian pattern: numbers only, no Three).

export type IntegralResultBody = IntegralAnalysisOkResult | IntegralAnalysisNonOkResult;

export interface IntegralResultEntry {
  /** Composite job signature the result was computed for. */
  signature: string;
  result: IntegralResultBody;
}

interface IntegralResultsState {
  entries: Record<string, IntegralResultEntry>;
  setResult: (key: string, entry: IntegralResultEntry) => void;
  removeForSource: (sourceId: string) => void;
  clearAll: () => void;
}

export const INTEGRAL_RESULT_PREFIX = "integral:";

export function integralResultKey(sourceId: string): string {
  return `${INTEGRAL_RESULT_PREFIX}${sourceId}`;
}

export const useIntegralResultsStore = create<IntegralResultsState>()((set) => ({
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
      const key = integralResultKey(sourceId);
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
