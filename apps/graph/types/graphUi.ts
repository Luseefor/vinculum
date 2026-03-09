import type { GraphObject } from "@vinculum/scene/types";

export type ExpressionFocusDirection = "up" | "down";
export type ExpressionRemoveReason = "button" | "keyboard";
export type ViewportMode = "2d" | "3d";

export type SceneDialogMode = "import" | "export";

export interface SceneDialogState {
  isOpen: boolean;
  mode: SceneDialogMode;
  jsonText: string;
  error: string | null;
}

export interface GraphUiState {
  selectedObjectId: string | null;
  viewportMode: ViewportMode;
  sceneDialog: SceneDialogState;
}

export interface ExpressionValidationState {
  error: string | null;
}

export interface ExpressionRowProps {
  rowIndex: number;
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
