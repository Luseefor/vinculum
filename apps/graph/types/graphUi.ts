import type { GraphObject } from "@vinculum/scene/types";

export type ExpressionFocusDirection = "up" | "down";
export type ExpressionRemoveReason = "button" | "keyboard";

export type SceneDialogMode = "import" | "export";
export type GraphMode = "2d" | "3d";
export type ThemeMode = "system" | "light" | "dark";
export type Axis2DPair = "xy" | "yz" | "xz";

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
