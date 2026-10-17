import type { SceneParameter } from "@/lib/scene/sceneSchema";
import { useEditorStore } from "./editorStore";

let restoring = false;

export function isRestoringSceneParameters(): boolean {
  return restoring;
}

/** Scene replacement and undo restore the existing editor-owned runtime scope. */
export function restoreSceneParameters(parameters: readonly SceneParameter[], apply: () => void): void {
  const previous = restoring;
  restoring = true;
  try {
    useEditorStore.setState({ parameters: parameters.map(parameter => ({ ...parameter })) });
    apply();
  } finally {
    restoring = previous;
  }
}
