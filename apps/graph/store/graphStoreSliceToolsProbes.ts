import { applySceneCommand } from "@/lib/scene/applyCommand";
import { createMeasurementId } from "@/lib/measurements/measurementMath";
import { project2dPairToWorld } from "./graphStoreProjection";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";
import type { GraphUiState } from "@/types/graphUi";

export function buildToolsProbesSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "setCanvas2dTool"
  | "setCanvas3dTool"
  | "setBaseline3dPlane"
  | "setProbePinnedMath"
  | "setProbePinnedWorld"
  | "removeProbePin"
  | "removeMeasurement"
  | "selectMeasurement"
  | "clearProbes"
> {
  const applyMeasurementPoint = (
    state: GraphStoreState,
    point: { x: number; y: number; z: number },
    tool: GraphStoreState["ui"]["canvas2dTool"] | GraphStoreState["ui"]["canvas3dTool"]
  ) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      return state;
    }
    if (tool === "probe") {
      return {
        ui: {
          ...state.ui,
          measurementDraft: null
        }
      };
    }

    if (tool === "addPin") {
      const nextScene = applySceneCommand(state.scene, {
        type: "ADD_MEASUREMENT",
        payload: {
          measurement: {
            id: createMeasurementId("pin"),
            kind: "pin",
            point
          }
        }
      });
      return {
        scene: nextScene,
        ui: {
          ...state.ui,
          measurementDraft: null,
          selectedMeasurementId: null,
          probePins: extractPins(nextScene)
        }
      };
    }

    if (tool === "measureDistance" || tool === "measureAngle") {
      const expectedPoints = tool === "measureDistance" ? 2 : 3;
      const currentDraft: NonNullable<GraphUiState["measurementDraft"]> =
        state.ui.measurementDraft?.kind === (tool === "measureDistance" ? "distance" : "angle")
          ? state.ui.measurementDraft
          : {
              kind: tool === "measureDistance" ? "distance" : "angle",
              points: []
            };
      const nextPoints = [...currentDraft.points, point];
      if (nextPoints.length < expectedPoints) {
        return {
          ui: {
            ...state.ui,
            measurementDraft: {
              ...currentDraft,
              points: nextPoints
            }
          }
        };
      }

      const nextScene = applySceneCommand(state.scene, {
        type: "ADD_MEASUREMENT",
        payload: {
          measurement:
            tool === "measureDistance"
              ? {
                  id: createMeasurementId("dist"),
                  kind: "distance",
                  points: [nextPoints[0], nextPoints[1]]
                }
              : {
                  id: createMeasurementId("angle"),
                  kind: "angle",
                  points: [nextPoints[0], nextPoints[1], nextPoints[2]]
                }
        }
      });

      return {
        scene: nextScene,
        ui: {
          ...state.ui,
          measurementDraft: null,
          probePins: extractPins(nextScene)
        }
      };
    }

    return state;
  };

  return {
    setCanvas2dTool: (tool) => {
      set((state) => ({
        ui: {
          ...state.ui,
          canvas2dTool: tool,
          selectedMeasurementId: null,
          measurementDraft:
            tool === "measureDistance" || tool === "measureAngle" ? state.ui.measurementDraft : null
        }
      }));
    },

    setCanvas3dTool: (tool) => {
      set((state) => ({
        ui: {
          ...state.ui,
          canvas3dTool: tool,
          selectedMeasurementId: null,
          measurementDraft:
            tool === "measureDistance" || tool === "measureAngle" ? state.ui.measurementDraft : null
        }
      }));
    },

    setBaseline3dPlane: (pair) => {
      set((state) => ({
        ui: {
          ...state.ui,
          baseline3dPlane: pair
        }
      }));
    },

    setProbePinnedMath: (point) => {
      set((state) => {
        if (!point) {
          return state;
        }
        const worldPoint = project2dPairToWorld(point, state.ui.axis2dPair);
        return applyMeasurementPoint(state, worldPoint, state.ui.canvas2dTool);
      });
    },

    setProbePinnedWorld: (point) => {
      set((state) => {
        if (!point) {
          return state;
        }
        return applyMeasurementPoint(state, point, state.ui.canvas3dTool);
      });
    },

    removeProbePin: (id) => {
      set((state) => {
        const nextScene = applySceneCommand(state.scene, {
          type: "REMOVE_MEASUREMENT",
          payload: { id }
        });
        return {
          scene: nextScene,
          ui: {
            ...state.ui,
            selectedMeasurementId: state.ui.selectedMeasurementId === id ? null : state.ui.selectedMeasurementId,
            probePins: extractPins(nextScene)
          }
        };
      });
    },
    removeMeasurement: (id) => {
      set((state) => {
        const nextScene = applySceneCommand(state.scene, {
          type: "REMOVE_MEASUREMENT",
          payload: { id }
        });
        return {
          scene: nextScene,
          ui: {
            ...state.ui,
            selectedMeasurementId: state.ui.selectedMeasurementId === id ? null : state.ui.selectedMeasurementId,
            probePins: extractPins(nextScene)
          }
        };
      });
    },
    selectMeasurement: (id) => {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedMeasurementId: id
        }
      }));
    },

    clearProbes: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          measurementDraft: null
        }
      }));
    }
  };
}

function extractPins(scene: GraphStoreState["scene"]): GraphStoreState["ui"]["probePins"] {
  return scene.measurements
    .filter((measurement) => measurement.kind === "pin")
    .map((measurement, index) => ({
      id: measurement.id,
      color: PROBE_PIN_COLORS[index % PROBE_PIN_COLORS.length] ?? "#f472b6",
      world: measurement.point
    }));
}

const PROBE_PIN_COLORS = [
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#34d399",
  "#60a5fa"
] as const;
