import type { GraphUiState, IntegralAnalysisConfig } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

// S25 integral-analysis config state: transient, target-attached,
// Inspector-driven. Lives in graphStore.ui (never in scene → no history
// pollution, no persistence, no serialization), following the S22–S24
// focused-slice pattern (not a new store). Computed numbers live in the
// integral-result cache; this map holds the analysis configuration only.
//
// Source identities reuse canonical math-only helpers wherever they
// already cover the mathematics (explicit surfaces → scalarViz identity,
// vector fields → vector-calculus identity). Curves and parametric
// surfaces get small integral-specific identities below: expressions +
// canonical domains + parameter keys, never render sampling (samples,
// resolution), appearance, or parameter values.

// Math-only identity for parametric-curve integral targets. Covers the
// integration mathematics only: kind, id, axis expressions, the canonical
// t domain, and sorted parameter keys. Excludes render sampling
// (samples), color, and visibility.
export function integralCurveMathIdentity(object: GraphObject, paramKeys?: string[]): string | null {
  if (object.kind !== "parametricCurve") {
    return null;
  }
  const keys = [...(paramKeys ?? [])].sort().join(",");
  return `integralCurve|${object.id}|${object.xExpr}|${object.yExpr}|${object.zExpr}|${object.tMin}|${object.tMax}|${keys}`;
}

// Math-only identity for parametric-surface integral targets. Covers the
// integration mathematics only: kind, id, axis expressions, the canonical
// u/v domain, and sorted parameter keys. Excludes render tessellation
// (resolution), appearance, and visibility.
export function integralParametricSurfaceMathIdentity(
  object: GraphObject,
  paramKeys?: string[]
): string | null {
  if (object.kind !== "parametricSurface") {
    return null;
  }
  const keys = [...(paramKeys ?? [])].sort().join(",");
  const domainSig = JSON.stringify(object.domain);
  return `integralParametricSurface|${object.id}|${object.xExpr}|${object.yExpr}|${object.zExpr}|${domainSig}|${keys}`;
}

export function defaultIntegralConfig(sourceId: string): IntegralAnalysisConfig {
  return {
    sourceId,
    mode: "arcLength",
    scalarIntegrand: "",
    vectorFieldId: null,
    quality: "medium",
    direction: 1,
    orientationSign: 1
  };
}

// Drops the integral config for one target id. Same-ref no-op when
// absent (keeps render-only edits cheap for subscribers).
export function pruneIntegralForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.integralAnalysisBySourceId[sourceId]) {
    return ui;
  }
  const nextRecords = { ...ui.integralAnalysisBySourceId };
  delete nextRecords[sourceId];
  return { ...ui, integralAnalysisBySourceId: nextRecords };
}

export function clearAllIntegralAnalysis(ui: GraphUiState): GraphUiState {
  if (Object.keys(ui.integralAnalysisBySourceId).length === 0) {
    return ui;
  }
  return { ...ui, integralAnalysisBySourceId: {} };
}

// Target ids whose configs reference a vector field (for result pruning
// when that field changes or disappears).
export function integralSourcesReferencingField(ui: GraphUiState, fieldId: string): string[] {
  const sources: string[] = [];
  for (const [sourceId, config] of Object.entries(ui.integralAnalysisBySourceId)) {
    if (config.vectorFieldId === fieldId) {
      sources.push(sourceId);
    }
  }
  return sources;
}

// Clears the vector-field selection from every config referencing the
// deleted field (PART 41): work/flux becomes "select a field" instead of
// presenting a stale numeric result. Same-ref no-op when unreferenced.
export function clearIntegralFieldSelection(ui: GraphUiState, fieldId: string): GraphUiState {
  let changed = false;
  const nextRecords: Record<string, IntegralAnalysisConfig> = {};
  for (const [sourceId, config] of Object.entries(ui.integralAnalysisBySourceId)) {
    if (config.vectorFieldId === fieldId) {
      changed = true;
      nextRecords[sourceId] = { ...config, vectorFieldId: null };
    } else {
      nextRecords[sourceId] = config;
    }
  }
  if (!changed) {
    return ui;
  }
  return { ...ui, integralAnalysisBySourceId: nextRecords };
}

export function buildIntegralSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "setIntegralConfig" | "clearIntegralAnalysis"
> {
  return {
    setIntegralConfig: (sourceId, patch) => {
      set((state) => {
        const current =
          state.ui.integralAnalysisBySourceId[sourceId] ?? defaultIntegralConfig(sourceId);
        const next: IntegralAnalysisConfig = {
          sourceId,
          mode: patch.mode ?? current.mode,
          scalarIntegrand: patch.scalarIntegrand ?? current.scalarIntegrand,
          vectorFieldId: patch.vectorFieldId !== undefined ? patch.vectorFieldId : current.vectorFieldId,
          quality: patch.quality ?? current.quality,
          direction: patch.direction ?? current.direction,
          orientationSign: patch.orientationSign ?? current.orientationSign
        };
        const prev = state.ui.integralAnalysisBySourceId[sourceId];
        if (
          prev &&
          prev.mode === next.mode &&
          prev.scalarIntegrand === next.scalarIntegrand &&
          prev.vectorFieldId === next.vectorFieldId &&
          prev.quality === next.quality &&
          prev.direction === next.direction &&
          prev.orientationSign === next.orientationSign
        ) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            integralAnalysisBySourceId: {
              ...state.ui.integralAnalysisBySourceId,
              [sourceId]: next
            }
          }
        };
      });
    },

    clearIntegralAnalysis: (sourceId) => {
      set((state) => {
        if (sourceId) {
          const nextUi = pruneIntegralForSourceId(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        const nextUi = clearAllIntegralAnalysis(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    }
  };
}
