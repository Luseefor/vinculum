import type {
  GraphObject,
  VectorFieldDimension
} from "@vinculum/scene/types";

export type ExpressionFocusDirection = "up" | "down";
export type ExpressionRemoveReason = "button" | "keyboard";

export type SceneDialogMode = "import" | "export";
export type GraphMode = "2d" | "3d" | "split";
/**
 * Product workspace: which kind of work the UI organizes around.
 * UI preference only — it never determines which objects exist.
 * The canonical scene is shared across workspaces.
 */
export type WorkspaceId = "geometry" | "math";
export type ThemeMode = "system" | "light" | "dark";
export type UiDensity = "comfortable" | "balanced" | "compact";
export type AccentPreset =
  | "indigo"
  | "blue"
  | "cyan"
  | "emerald"
  | "green"
  | "amber"
  | "orange"
  | "rose"
  | "pink"
  | "violet";
export type Axis2DPair = "xy" | "yz" | "xz";
/** Which 2D viewport receives toolbar plane (XY/XZ/YZ) changes in quad layout. */
export type Active2dViewportSlot = "primary" | "quadTop";

/** 2D canvas interaction mode: pan the view, probe coordinates, or sketch a curve to fit. */
export type Canvas2DTool = "pan" | "probe" | "draw" | "measureDistance" | "measureAngle" | "addPin";
/** 3D viewport interaction mode: pan camera, probe a point, or sketch a curve on the ground plane. */
export type Canvas3DTool = "pan" | "probe" | "draw" | "measureDistance" | "measureAngle" | "addPin";

export interface SceneDialogState {
  isOpen: boolean;
  mode: SceneDialogMode;
  jsonText: string;
  error: string | null;
}

export interface ProjectSessionState {
  currentProjectId: string | null;
  currentProjectName: string | null;
  autosaveStatus: "idle" | "dirty" | "saving" | "saved" | "error";
  autosaveError: string | null;
}

export interface Viewport2D {
  centerX: number;
  centerY: number;
  scale: number; // pixels per unit
}

export interface Viewport2DFrame {
  width: number;
  height: number;
}

/** World-space pin shown on the 2D graph and in the object list. */
export type GraphProbePin = { id: string; color: string; world: { x: number; y: number; z: number } };

export interface GraphUiState {
  selectedObjectId: string | null;
  selectedMeasurementId: string | null;
  /** Active product workspace. UI preference; the scene is shared. */
  workspace: WorkspaceId;
  /** Transient request to focus an object's primary equation input after creation. Cleared on consume. */
  focusEquationForObjectId: string | null;
  sceneDialog: SceneDialogState;
  projectSession: ProjectSessionState;
  graphMode: GraphMode;
  themeMode: ThemeMode;
  accentPreset: AccentPreset;
  density: UiDensity;
  /** Plane for the primary 2D view (single / split / quad top-left). */
  axis2dPair: Axis2DPair;
  /** Plane for the quad bottom-right 2D view. */
  axis2dPairQuadTop: Axis2DPair;
  /** Focused 2D viewport for the toolbar plane switcher (quad only). */
  active2dViewport: Active2dViewportSlot;
  viewport2d: Viewport2D;
  viewport2dFrame: Viewport2DFrame;
  /** Independent 2D camera for quad layout bottom-right (top / XZ plane). */
  viewport2dQuadTop: Viewport2D;
  viewport2dQuadTopFrame: Viewport2DFrame;
  canvas2dTool: Canvas2DTool;
  canvas3dTool: Canvas3DTool;
  /** Baseline plane for 3D grid + sketch/probe plane picking (through origin). */
  baseline3dPlane: Axis2DPair;
  measurementDraft: {
    kind: "distance" | "angle";
    points: { x: number; y: number; z: number }[];
  } | null;
  probePins: GraphProbePin[];
  /** Extrapolation past the sketch parameter range: t in [-extend, 1+extend] when stroke is parameterized on [0,1]. */
  sketchExtendFraction: number;
  /** When true, sketch strokes create curves immediately; when false, user confirms from preview card. */
  sketchAutoCreate: boolean;
  /** Enables coordinate snapping for probe/sketch interactions. */
  snapEnabled: boolean;
  /** Snap grid spacing in math units for probe/sketch interactions. */
  snapStep: number;
  /**
   * S21 transient differential-analysis records keyed by source object id.
   * Probe-like inspection state: point (math coords), the source structure
   * captured at pick, and overlay flags. Never serialized (see persist
   * partialize); computed derivatives are recomputed live, never stored.
   */
  differentialAnalysisBySourceId: Record<string, DifferentialAnalysisState>;
  /** Source id awaiting the next surface click, or null when not picking. */
  differentialAnalysisPickArmedId: string | null;
  /**
   * S22 transient vector-calculus records keyed by source field id.
   * Separate map (not forced into the surface record type): point in
   * canonical math coords, math identity with parameter KEYS (values
   * recompute live per PART 9), and the curl-overlay flag. Never
   * serialized; Jacobian/divergence/curl recompute live, never stored.
   */
  vectorCalculusBySourceId: Record<string, VectorCalculusState>;
  /**
   * S22 transient directional-derivative inputs keyed by source surface
   * id. Independent lifecycle from the analysis point (survives re-pick
   * and equation edits; pruned on delete/kind-switch/replace/reset).
   */
  directionInputBySourceId: Record<string, { u: number; v: number }>;
  /**
   * S24 transient streamline configs keyed by source field id. Toggles
   * and numeric settings only — computed polylines live in the
   * streamline-result cache, never here and never serialized.
   */
  streamlineVizBySourceId: Record<string, StreamlineVizConfig>;
  /**
   * S23 transient scalar-visualization configs keyed by source id.
   * Toggles and numeric settings only — computed grids live in the
   * scalar-result cache, never here and never serialized. 2D fields use
   * the heat/contour/gradient half; implicit sources use the slice half.
   */
  scalarVizBySourceId: Record<string, ScalarVizConfig>;
}

export interface StreamlineVizConfig {
  sourceId: string;
  /** Math-only source identity at enable (see vectorCalculusSourceIdentity). */
  structure: string;
  /** Source dimension at enable (dimension switches clear the config). */
  dimension: "2d" | "3d";
  enabled: boolean;
  seedDensity: number;
  length: "short" | "medium" | "long";
  quality: "low" | "medium" | "high";
}

export interface ScalarVizConfig {
  sourceId: string;
  /** Math-only source identity at enable (see scalarVizMathIdentity). */
  structure: string;
  showHeatmap: boolean;
  showContours: boolean;
  contourCount: number;
  showGradient: boolean;
  gradientDensity: number;
  gradientScale: number;
  gradientNormalize: boolean;
  sliceEnabled: boolean;
  slicePlane: "xy" | "xz" | "yz";
  sliceValue: number;
  showSliceHeatmap: boolean;
  showSliceContours: boolean;
}

export interface DifferentialAnalysisState {
  sourceId: string;
  /** Canonical math coordinates (worldToMath3D applied once at pick). */
  point: { x: number; y: number; z: number };
  /** Math-only source identity at pick (see analysisSourceIdentity). */
  structure: string;
  showNormal: boolean;
  showTangent: boolean;
}

export interface VectorCalculusState {
  sourceId: string;
  /** Canonical math coordinates; 2D uses x/y (z ignored). */
  point: { x: number; y: number; z: number };
  /** Math identity with parameter keys (see vectorCalculusSourceIdentity). */
  structure: string;
  showCurl: boolean;
}

export interface ExpressionValidationState {
  error: string | null;
}

export interface ExpressionRowProps {
  object: GraphObject;
  isSelected: boolean;
  canRemoveWithBackspace: boolean;
  registerInputRef: (id: string, node: HTMLInputElement | null) => void;
  onSelect: (id: string) => void;
  onMoveFocus: (id: string, direction: ExpressionFocusDirection) => void;
  onInsertBelow: (id: string, kind: GraphObject["kind"], dimension?: VectorFieldDimension) => void;
  onRemove: (id: string, reason: ExpressionRemoveReason) => void;
  onOpenInspector: (id: string) => void;
}
