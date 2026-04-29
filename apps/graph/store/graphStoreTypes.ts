import type { StoreApi } from "zustand";
import type { SceneSnapshot } from "@/lib/types/scene";
import type {
  GraphObjectKind,
  ParametricCurveObject,
  PlaneGraphObject,
  SurfaceDomain,
  SurfaceGraphObject,
  SurfaceOrientation
} from "@vinculum/scene/types";
import type {
  Active2dViewportSlot,
  Axis2DPair,
  Canvas2DTool,
  Canvas3DTool,
  GraphUiState,
  SceneDialogMode,
  Viewport2D,
  Viewport2DFrame
} from "@/types/graphUi";
import type { SceneDocument } from "@/lib/scene/sceneSchema";

export type ParametricExpressionField = keyof Pick<
  ParametricCurveObject,
  "xExpr" | "yExpr" | "zExpr" | "tMin" | "tMax" | "samples"
>;

export interface GraphStoreState {
  scene: SceneDocument;
  ui: GraphUiState;
  cameraResetVersion: number;
  addSurfaceObject: () => string;
  addParametricCurve: () => string;
  addPlaneObject: () => string;
  addEmptyObject: () => string;
  insertObjectAfter: (id: string, kind: GraphObjectKind) => string;
  setObjectKind: (id: string, kind: GraphObjectKind) => void;
  updateSurfaceEquation: (id: string, equation: string) => void;
  updateSurfaceOrientation: (id: string, orientation: SurfaceOrientation) => void;
  updateParametricExpression: (
    id: string,
    field: ParametricExpressionField,
    value: string | number
  ) => void;
  updatePlaneEquation: (id: string, equation: string) => void;
  toggleObjectVisibility: (id: string) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  selectObject: (id: string) => void;
  removeObject: (id: string) => void;
  updateObjectColor: (id: string, color: string) => void;
  updateSurfaceDomain: (id: string, partialDomain: Partial<SurfaceDomain>) => void;
  updateSurfaceResolution: (id: string, resolution: number) => void;
  toggleSurfaceWireframe: (id: string) => void;
  replaceSceneDocument: (sceneDocument: SceneDocument) => void;
  resetScene: () => void;
  openSceneDialog: (mode: SceneDialogMode) => void;
  closeSceneDialog: () => void;
  setSceneDialogDraft: (jsonText: string) => void;
  setSceneDialogError: (error: string | null) => void;
  setCurrentProjectSession: (project: { id: string; name: string } | null) => void;
  setProjectAutosaveStatus: (
    status: GraphUiState["projectSession"]["autosaveStatus"],
    error?: string | null
  ) => void;
  requestCameraReset: () => void;
  setGraphMode: (mode: GraphUiState["graphMode"]) => void;
  setAxis2DPair: (pair: Axis2DPair) => void;
  setActive2dViewport: (slot: Active2dViewportSlot) => void;
  setThemeMode: (mode: GraphUiState["themeMode"]) => void;
  setAccentPreset: (preset: GraphUiState["accentPreset"]) => void;
  setDensity: (density: GraphUiState["density"]) => void;
  hydrateThemeMode: () => void;
  hydrateAccentPreset: () => void;
  hydrateDensity: () => void;
  cycleThemeMode: () => void;
  updateViewport2D: (viewport: Partial<Viewport2D>) => void;
  updateViewport2DQuadTop: (viewport: Partial<Viewport2D>) => void;
  setViewport2DFrame: (frame: Viewport2DFrame) => void;
  setViewport2DQuadTopFrame: (frame: Viewport2DFrame) => void;
  resetViewport2D: () => void;
  resetViewport2DQuadTop: () => void;
  setCanvas2dTool: (tool: Canvas2DTool) => void;
  setCanvas3dTool: (tool: Canvas3DTool) => void;
  setBaseline3dPlane: (pair: Axis2DPair) => void;
  setProbePinnedMath: (point: { horizontal: number; vertical: number } | null) => void;
  setProbePinnedWorld: (point: { x: number; y: number; z: number } | null) => void;
  removeProbePin: (id: string) => void;
  clearProbes: () => void;
  setSketchExtendFraction: (fraction: number) => void;
  setSketchAutoCreate: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapStep: (step: number) => void;
  applySceneSnapshot: (snapshot: SceneSnapshot) => void;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  addSketchedParametricFromStroke3d: (stroke: { x: number; y: number; z: number }[]) => string;
}

export type GraphStoreSet = StoreApi<GraphStoreState>["setState"];
