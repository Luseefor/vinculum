import { DEFAULT_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import type { GraphUiState, Viewport2D } from "@/types/graphUi";

export function createDefaultViewport2D(): Viewport2D {
  return {
    centerX: 0,
    centerY: 0,
    scale: DEFAULT_VIEWPORT_SCALE
  };
}

export function createInitialUiState(selectedObjectId: string | null): GraphUiState {
  return {
    selectedObjectId,
    sceneDialog: {
      isOpen: false,
      mode: "export",
      jsonText: "",
      error: null
    },
    graphMode: "3d",
    themeMode: "system",
    accentPreset: "indigo",
    density: "balanced",
    axis2dPair: "xy",
    axis2dPairQuadTop: "xz",
    active2dViewport: "primary",
    viewport2d: createDefaultViewport2D(),
    viewport2dFrame: {
      width: 0,
      height: 0
    },
    viewport2dQuadTop: createDefaultViewport2D(),
    viewport2dQuadTopFrame: {
      width: 0,
      height: 0
    },
    canvas2dTool: "pan",
    canvas3dTool: "pan",
    baseline3dPlane: "xy",
    probePins: [],
    sketchExtendFraction: 0.15,
    sketchAutoCreate: true,
    snapEnabled: true,
    snapStep: 0.25
  };
}
