import { sanitizeViewportPatch } from "@/lib/graph/viewport";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";
import { createDefaultViewport2D } from "./graphStoreViewportInit";

export function buildViewport2dSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "updateViewport2D"
  | "setViewport2DFrame"
  | "setViewport2DQuadTopFrame"
  | "resetViewport2D"
  | "resetViewport2DQuadTop"
  | "updateViewport2DQuadTop"
> {
  return {
    updateViewport2D: (viewport) => {
      set((state) => {
        const nextViewport = sanitizeViewportPatch(state.ui.viewport2d, viewport);
        if (
          nextViewport.centerX === state.ui.viewport2d.centerX &&
          nextViewport.centerY === state.ui.viewport2d.centerY &&
          nextViewport.scale === state.ui.viewport2d.scale
        ) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            viewport2d: nextViewport
          }
        };
      });
    },

    setViewport2DFrame: (frame) => {
      set((state) => ({
        ui: {
          ...state.ui,
          viewport2dFrame: {
            width: Math.max(0, Math.floor(frame.width)),
            height: Math.max(0, Math.floor(frame.height))
          }
        }
      }));
    },

    setViewport2DQuadTopFrame: (frame) => {
      set((state) => ({
        ui: {
          ...state.ui,
          viewport2dQuadTopFrame: {
            width: Math.max(0, Math.floor(frame.width)),
            height: Math.max(0, Math.floor(frame.height))
          }
        }
      }));
    },

    resetViewport2D: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          viewport2d: createDefaultViewport2D()
        }
      }));
    },

    resetViewport2DQuadTop: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          viewport2dQuadTop: createDefaultViewport2D()
        }
      }));
    },

    updateViewport2DQuadTop: (viewport) => {
      set((state) => {
        const nextViewport = sanitizeViewportPatch(state.ui.viewport2dQuadTop, viewport);
        if (
          nextViewport.centerX === state.ui.viewport2dQuadTop.centerX &&
          nextViewport.centerY === state.ui.viewport2dQuadTop.centerY &&
          nextViewport.scale === state.ui.viewport2dQuadTop.scale
        ) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            viewport2dQuadTop: nextViewport
          }
        };
      });
    }
  };
}
