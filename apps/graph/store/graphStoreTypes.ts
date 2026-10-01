import type { StoreApi } from "zustand";
import type { SceneSnapshot } from "@/lib/types/scene";
import type {
  GraphObject,
  GraphObjectKind,
  ImplicitSurfaceObject,
  LinearTransformDimension,
  LinearTransformObject2D,
  LinearTransformObject3D,
  LineObject,
  ParametricCurveObject,
  ParametricSurfaceObject,
  PlaneGraphObject,
  PointObject,
  RayObject,
  SegmentObject,
  SurfaceDomain,
  SurfaceGraphObject,
  SurfaceOrientation,
  VectorFieldDimension,
  VectorFieldObject,
  VectorFieldObject3D,
  VectorObject
} from "@vinculum/scene/types";
import type {
  Active2dViewportSlot,
  Axis2DPair,
  Canvas2DTool,
  Canvas3DTool,
  GeometryAnalysisConfig,
  GraphUiState,
  IntegralAnalysisConfig,
  LinearTransformAnalysisConfig,
  ScalarVizConfig,
  SceneDialogMode,
  StreamlineVizConfig,
  Viewport2D,
  Viewport2DFrame,
  WorkspaceId
} from "@/types/graphUi";
import type { SceneDocument } from "@/lib/scene/sceneSchema";

export type ParametricExpressionField = keyof Pick<
  ParametricCurveObject,
  "xExpr" | "yExpr" | "zExpr" | "tMin" | "tMax" | "samples"
>;

export type ParametricSurfaceField = keyof Pick<
  ParametricSurfaceObject,
  "xExpr" | "yExpr" | "zExpr" | "resolution"
> | keyof Pick<ParametricSurfaceObject["domain"], "uMin" | "uMax" | "vMin" | "vMax">;

export type ImplicitSurfaceField =
  | keyof Pick<ImplicitSurfaceObject, "equation" | "resolution">
  | keyof Pick<ImplicitSurfaceObject["domain"], "xMin" | "xMax" | "yMin" | "yMax" | "zMin" | "zMax">;

export type VectorFieldField =
  | keyof Pick<VectorFieldObject, "pExpr" | "qExpr" | "rExpr" | "density" | "scale" | "normalize">
  | keyof Pick<VectorFieldObject3D["domain"], "xMin" | "xMax" | "yMin" | "yMax" | "zMin" | "zMax">;

// S26/S27: flat coordinate-expression fields across the geometric
// primitives (each kind owns its set; the updater whitelists per kind).
// Point shares x/y/zExpr names with parametric curves; the kind gate in
// updateGeometryCoordinate keeps the namespaces separate.
export type GeometryPrimitiveField =
  | keyof Pick<PointObject, "xExpr" | "yExpr" | "zExpr">
  | keyof Pick<VectorObject, "oxExpr" | "oyExpr" | "ozExpr" | "vxExpr" | "vyExpr" | "vzExpr">
  | keyof Pick<LineObject, "pxExpr" | "pyExpr" | "pzExpr" | "dxExpr" | "dyExpr" | "dzExpr">
  | keyof Pick<RayObject, "oxExpr" | "oyExpr" | "ozExpr" | "dxExpr" | "dyExpr" | "dzExpr">
  | keyof Pick<SegmentObject, "axExpr" | "ayExpr" | "azExpr" | "bxExpr" | "byExpr" | "bzExpr">;

export type LinearTransformEntryField =
  | keyof Pick<LinearTransformObject2D, "m11" | "m12" | "m21" | "m22">
  | keyof Pick<
      LinearTransformObject3D,
      "m11" | "m12" | "m13" | "m21" | "m22" | "m23" | "m31" | "m32" | "m33"
    >;

export interface GraphStoreState {
  scene: SceneDocument;
  ui: GraphUiState;
  cameraResetVersion: number;
  addDefinedObject: (object: GraphObject) => { id: string | null; error: string | null };
  addSurfaceObject: () => string;
  addParametricCurve: () => string;
  addPlaneObject: () => string;
  addParametricSurface: () => string;
  addImplicitSurface: () => string;
  addVectorFieldObject: (dimension: VectorFieldDimension) => string;
  addPointObject: () => string;
  addLinearTransformObject: (dimension: LinearTransformDimension) => string;
  addVectorObject: () => string;
  addLineObject: () => string;
  addRayObject: () => string;
  addSegmentObject: () => string;
  addEmptyObject: () => string;
  insertObjectAfter: (
    id: string,
    kind: GraphObjectKind,
    dimension?: VectorFieldDimension | LinearTransformDimension
  ) => string;
  setObjectKind: (
    id: string,
    kind: GraphObjectKind,
    dimension?: VectorFieldDimension | LinearTransformDimension
  ) => void;
  updateSurfaceEquation: (id: string, equation: string) => void;
  updateSurfaceOrientation: (id: string, orientation: SurfaceOrientation) => void;
  updateParametricExpression: (
    id: string,
    field: ParametricExpressionField,
    value: string | number
  ) => void;
  updateParametricSurfaceExpression: (
    id: string,
    field: ParametricSurfaceField,
    value: string | number
  ) => void;
  updateImplicitSurfaceExpression: (
    id: string,
    field: ImplicitSurfaceField,
    value: string | number
  ) => void;
  updateVectorFieldExpression: (
    id: string,
    field: VectorFieldField,
    value: string | number | boolean
  ) => void;
  updateGeometryCoordinate: (id: string, field: GeometryPrimitiveField, value: string) => void;
  updateLinearTransformEntry: (id: string, field: LinearTransformEntryField, value: string) => void;
  updatePlaneEquation: (id: string, equation: string) => void;
  toggleObjectVisibility: (id: string) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  selectObject: (id: string) => void;
  deselectObject: () => void;
  removeObject: (id: string) => void;
  requestEquationFocus: (id: string) => void;
  clearEquationFocus: () => void;
  armDifferentialAnalysisPick: (sourceId: string | null) => void;
  setDifferentialAnalysisPoint: (
    sourceId: string,
    point: { x: number; y: number; z: number },
    structure: string
  ) => void;
  setDifferentialAnalysisOverlays: (
    sourceId: string,
    flags: { showNormal?: boolean; showTangent?: boolean }
  ) => void;
  clearDifferentialAnalysis: (sourceId?: string) => void;
  setVectorCalculusPoint: (
    sourceId: string,
    point: { x: number; y: number; z: number },
    structure: string
  ) => void;
  setVectorCalculusOverlays: (sourceId: string, flags: { showCurl?: boolean }) => void;
  clearVectorCalculus: (sourceId?: string) => void;
  setDirectionInput: (sourceId: string, input: { u: number; v: number } | null) => void;
  setScalarVizConfig: (
    sourceId: string,
    patch: Partial<Omit<ScalarVizConfig, "sourceId" | "structure">>,
    structure: string
  ) => void;
  clearScalarViz: (sourceId?: string) => void;
  setStreamlineConfig: (
    sourceId: string,
    patch: Partial<Omit<StreamlineVizConfig, "sourceId" | "structure">>,
    structure: string
  ) => void;
  clearStreamline: (sourceId?: string) => void;
  setIntegralConfig: (sourceId: string, patch: Partial<Omit<IntegralAnalysisConfig, "sourceId">>) => void;
  clearIntegralAnalysis: (sourceId?: string) => void;
  setGeometryAnalysis: (primaryId: string, patch: Partial<GeometryAnalysisConfig>) => void;
  clearGeometryAnalysis: (primaryId?: string) => void;
  setLinearTransformAnalysis: (transformId: string, patch: Partial<LinearTransformAnalysisConfig>) => void;
  clearLinearTransformAnalysis: (transformId?: string) => void;
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
  removeMeasurement: (id: string) => void;
  selectMeasurement: (id: string | null) => void;
  clearProbes: () => void;
  setSketchExtendFraction: (fraction: number) => void;
  setSketchAutoCreate: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapStep: (step: number) => void;
  setWorkspace: (workspace: WorkspaceId) => void;
  applySceneSnapshot: (snapshot: SceneSnapshot) => void;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  addSketchedParametricFromStroke3d: (stroke: { x: number; y: number; z: number }[]) => string;
}

export type GraphStoreSet = StoreApi<GraphStoreState>["setState"];
