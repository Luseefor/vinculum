import type { DifferentialAnalysisState, GraphUiState } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import { getParameterSignature } from "@/lib/graph3d/graphThreeEngineDom";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

// S21 differential-analysis state: transient, source-attached, probe-like.
// Lives in graphStore.ui (never in scene → no history pollution, no
// persistence, no serialization). One focused slice file following the
// established store-composition pattern (not a new store).
//
// Undo/redo note: applySceneSnapshot restores scene objects without touching
// ui, so a restored object keeps no analysis record (records were pruned on
// delete/edit). If a record somehow survives against changed math, the
// per-tick structure check and the Inspector self-heal clear it on the next
// frame — transient state never needs migration or snapshot seeding.

// Math-only source identity for analysis records. Deliberately narrower
// than the render sync's structure signature: appearance (wireframe),
// color, and visibility never affect derivatives, so style toggles retain
// analysis while equation/orientation/domain/resolution/parameter changes
// invalidate. Returns null for unsupported kinds.
export function analysisSourceIdentity(object: GraphObject): string | null {
  if (object.kind !== "surface" && object.kind !== "implicitSurface") {
    return null;
  }
  const domainSig = JSON.stringify(object.domain);
  const base = `${getParameterSignature()}|${object.kind}|${object.id}`;
  if (object.kind === "surface") {
    return `${base}|${object.orientation ?? "z"}|${object.equation}|${domainSig}|${object.resolution}`;
  }
  return `${base}|${object.equation}|${domainSig}|${object.resolution}`;
}

// S22 math-only vector-field identity for calculus records. Covers the
// mathematical function only: kind, id, dimension, component expressions,
// domain, and parameter KEYS (sorted). Deliberately excludes density,
// scale, normalize, color, visibility (PART 8/33: render/sampling config
// never invalidates calculus) and parameter VALUES (PART 9: value changes
// recompute live at the same point). Domain edits invalidate (PART 34:
// deliberate simplicity over containment-retain). Returns null for
// non-vector kinds.
export function vectorCalculusSourceIdentity(object: GraphObject, paramKeys?: string[]): string | null {
  if (object.kind !== "vectorField") {
    return null;
  }
  const keys = [...(paramKeys ?? [])].sort().join(",");
  return `vectorField|${object.id}|${object.dimension}|${object.pExpr}|${object.qExpr}|${object.rExpr}|${JSON.stringify(object.domain)}|${keys}`;
}

// Drops the vector-calculus record for one source id. Same-ref no-op when
// absent (keeps render-only edits cheap for subscribers).
export function pruneVectorCalculusForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.vectorCalculusBySourceId[sourceId]) {
    return ui;
  }
  const nextRecords = { ...ui.vectorCalculusBySourceId };
  delete nextRecords[sourceId];
  return { ...ui, vectorCalculusBySourceId: nextRecords };
}

export function clearAllVectorCalculus(ui: GraphUiState): GraphUiState {
  if (
    Object.keys(ui.vectorCalculusBySourceId).length === 0 &&
    Object.keys(ui.directionInputBySourceId).length === 0
  ) {
    return ui;
  }
  return { ...ui, vectorCalculusBySourceId: {}, directionInputBySourceId: {} };
}

function pruneDirectionInput(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.directionInputBySourceId[sourceId]) {
    return ui;
  }
  const next = { ...ui.directionInputBySourceId };
  delete next[sourceId];
  return { ...ui, directionInputBySourceId: next };
}

export function clearAnalysisAndVectorCalculus(ui: GraphUiState, sourceId: string): GraphUiState {
  return pruneDirectionInput(pruneVectorCalculusForSourceId(pruneAnalysisForSourceId(ui, sourceId), sourceId), sourceId);
}

export function clearAllAnalysisAndVectorCalculus(ui: GraphUiState): GraphUiState {
  return clearAllVectorCalculus(clearAllAnalysis(ui));
}

export type AnalysisFreshness = "current" | "stale-structure" | "pending-compute";

// Pure freshness resolver shared by the overlay sync and (via tests) the
// lifecycle pins. Pending hides the overlay but keeps the record; a
// structure mismatch means the record must be cleared.
export function resolveAnalysisFreshness(input: {
  record: DifferentialAnalysisState;
  liveStructure: string;
  computeStatus: "idle" | "pending" | "error";
}): AnalysisFreshness {
  if (input.computeStatus !== "idle") {
    return "pending-compute";
  }
  if (input.liveStructure !== input.record.structure) {
    return "stale-structure";
  }
  return "current";
}

// Drops the analysis record for one source id. Returns the same ui ref
// when nothing changes (keeps no-op edits cheap for subscribers).
export function pruneAnalysisForSourceId(ui: GraphUiState, sourceId: string): GraphUiState {
  if (!ui.differentialAnalysisBySourceId[sourceId] && ui.differentialAnalysisPickArmedId !== sourceId) {
    return ui;
  }
  const nextRecords = { ...ui.differentialAnalysisBySourceId };
  delete nextRecords[sourceId];
  return {
    ...ui,
    differentialAnalysisBySourceId: nextRecords,
    differentialAnalysisPickArmedId:
      ui.differentialAnalysisPickArmedId === sourceId ? null : ui.differentialAnalysisPickArmedId
  };
}

export function clearAllAnalysis(ui: GraphUiState): GraphUiState {
  if (
    Object.keys(ui.differentialAnalysisBySourceId).length === 0 &&
    ui.differentialAnalysisPickArmedId === null
  ) {
    return ui;
  }
  return {
    ...ui,
    differentialAnalysisBySourceId: {},
    differentialAnalysisPickArmedId: null
  };
}

export function buildAnalysisSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "armDifferentialAnalysisPick"
  | "setDifferentialAnalysisPoint"
  | "setDifferentialAnalysisOverlays"
  | "clearDifferentialAnalysis"
  | "setVectorCalculusPoint"
  | "setVectorCalculusOverlays"
  | "clearVectorCalculus"
  | "setDirectionInput"
> {
  return {
    armDifferentialAnalysisPick: (sourceId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          differentialAnalysisPickArmedId: sourceId
        }
      }));
    },

    setDifferentialAnalysisPoint: (sourceId, point, structure) => {
      set((state) => ({
        ui: {
          ...state.ui,
          differentialAnalysisBySourceId: {
            ...state.ui.differentialAnalysisBySourceId,
            [sourceId]: {
              sourceId,
              point: { ...point },
              structure,
              showNormal: true,
              showTangent: true
            }
          },
          differentialAnalysisPickArmedId:
            state.ui.differentialAnalysisPickArmedId === sourceId
              ? null
              : state.ui.differentialAnalysisPickArmedId
        }
      }));
    },

    setDifferentialAnalysisOverlays: (sourceId, flags) => {
      set((state) => {
        const record = state.ui.differentialAnalysisBySourceId[sourceId];
        if (!record) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            differentialAnalysisBySourceId: {
              ...state.ui.differentialAnalysisBySourceId,
              [sourceId]: {
                ...record,
                showNormal: flags.showNormal ?? record.showNormal,
                showTangent: flags.showTangent ?? record.showTangent
              }
            }
          }
        };
      });
    },

    clearDifferentialAnalysis: (sourceId) => {
      set((state) => {
        if (sourceId) {
          const nextUi = pruneAnalysisForSourceId(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        const nextUi = clearAllAnalysis(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    },

    setVectorCalculusPoint: (sourceId, point, structure) => {
      set((state) => ({
        ui: {
          ...state.ui,
          vectorCalculusBySourceId: {
            ...state.ui.vectorCalculusBySourceId,
            [sourceId]: {
              sourceId,
              point: { ...point },
              structure,
              showCurl: state.ui.vectorCalculusBySourceId[sourceId]?.showCurl ?? false
            }
          }
        }
      }));
    },

    setVectorCalculusOverlays: (sourceId, flags) => {
      set((state) => {
        const record = state.ui.vectorCalculusBySourceId[sourceId];
        if (!record) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            vectorCalculusBySourceId: {
              ...state.ui.vectorCalculusBySourceId,
              [sourceId]: { ...record, showCurl: flags.showCurl ?? record.showCurl }
            }
          }
        };
      });
    },

    clearVectorCalculus: (sourceId) => {
      set((state) => {
        if (sourceId) {
          const nextUi = pruneVectorCalculusForSourceId(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        const nextUi = clearAllVectorCalculus(state.ui);
        return nextUi === state.ui ? state : { ui: nextUi };
      });
    },

    setDirectionInput: (sourceId, input) => {
      set((state) => {
        if (input === null) {
          const nextUi = pruneDirectionInput(state.ui, sourceId);
          return nextUi === state.ui ? state : { ui: nextUi };
        }
        if (!Number.isFinite(input.u) || !Number.isFinite(input.v)) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            directionInputBySourceId: {
              ...state.ui.directionInputBySourceId,
              [sourceId]: { u: input.u, v: input.v }
            }
          }
        };
      });
    }
  };
}
