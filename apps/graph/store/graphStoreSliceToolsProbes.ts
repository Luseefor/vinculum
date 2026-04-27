import { createProbePin } from "./graphStoreProbe";
import { project2dPairToWorld } from "./graphStoreProjection";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildToolsProbesSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "setCanvas2dTool"
  | "setCanvas3dTool"
  | "setBaseline3dPlane"
  | "setProbePinnedMath"
  | "setProbePinnedWorld"
  | "removeProbePin"
  | "clearProbes"
> {
  return {
    setCanvas2dTool: (tool) => {
      set((state) => ({
        ui: {
          ...state.ui,
          canvas2dTool: tool
        }
      }));
    },

    setCanvas3dTool: (tool) => {
      set((state) => ({
        ui: {
          ...state.ui,
          canvas3dTool: tool
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
        return {
          ui: {
            ...state.ui,
            probePins: [...state.ui.probePins, createProbePin(worldPoint, state.ui.probePins.length)]
          }
        };
      });
    },

    setProbePinnedWorld: (point) => {
      set((state) => {
        if (!point) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            probePins: [...state.ui.probePins, createProbePin(point, state.ui.probePins.length)]
          }
        };
      });
    },

    removeProbePin: (id) => {
      set((state) => ({
        ui: {
          ...state.ui,
          probePins: state.ui.probePins.filter((p) => p.id !== id)
        }
      }));
    },

    clearProbes: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          probePins: []
        }
      }));
    }
  };
}
