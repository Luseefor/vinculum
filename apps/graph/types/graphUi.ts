import type { GraphObject } from "@vinculum/scene/types";

export type ExpressionFocusDirection = "up" | "down";
export type ExpressionRemoveReason = "button" | "keyboard";

export type SceneDialogMode = "import" | "export";
export type GraphMode = "2d" | "3d";
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
  onInsertBelow: (id: string, kind: GraphObject["kind"]) => void;
  onRemove: (id: string, reason: ExpressionRemoveReason) => void;
  onOpenInspector: (id: string) => void;
}
