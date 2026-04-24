import type { GraphObject } from "@vinculum/scene/types";

export type ExpressionFocusDirection = "up" | "down";
export type ExpressionRemoveReason = "button" | "keyboard";

export type SceneDialogMode = "import" | "export";
export type GraphMode = "2d" | "3d";
export type ThemeMode = "system" | "light" | "dark";
export type Axis2DPair = "xy" | "yz" | "xz";

/** 2D canvas interaction mode: pan the view, probe coordinates, or sketch a curve to fit. */
export type Canvas2DTool = "pan" | "probe" | "draw";
/** 3D viewport interaction mode: pan camera, probe a point, or sketch a curve on the ground plane. */
export type Canvas3DTool = "pan" | "probe" | "draw";

export interface SceneDialogState {
  isOpen: boolean;
  mode: SceneDialogMode;
  jsonText: string;
  error: string | null;
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

export interface GraphUiState {
  selectedObjectId: string | null;
  sceneDialog: SceneDialogState;
  graphMode: GraphMode;
  themeMode: ThemeMode;
  axis2dPair: Axis2DPair;
  viewport2d: Viewport2D;
  viewport2dFrame: Viewport2DFrame;
  canvas2dTool: Canvas2DTool;
  canvas3dTool: Canvas3DTool;
  /** When non-null, 2D probe mode shows a pinned point at these math coordinates (horizontal / vertical axes). */
  probePinnedMath: { horizontal: number; vertical: number } | null;
  /** When non-null, 3D probe mode shows a pinned world-space point. */
  probePinnedWorld: { x: number; y: number; z: number } | null;
  /** Extrapolation past the sketch parameter range: t in [-extend, 1+extend] when stroke is parameterized on [0,1]. */
  sketchExtendFraction: number;
  /** When true, sketch strokes create curves immediately; when false, user confirms from preview card. */
  sketchAutoCreate: boolean;
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
