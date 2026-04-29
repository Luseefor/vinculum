import type { SceneDocument } from "@/lib/scene/sceneSchema";

interface ApplySharedSceneInput {
  scene: SceneDocument;
  clearHistory: () => void;
  replaceSceneDocument: (scene: SceneDocument) => void;
  setCurrentProjectSession: (project: { id: string; name: string } | null) => void;
  setProjectAutosaveStatus: (
    status: "idle" | "dirty" | "saving" | "saved" | "error",
    error?: string | null
  ) => void;
}

export function applySharedSceneToEditor(input: ApplySharedSceneInput): void {
  input.clearHistory();
  input.replaceSceneDocument(input.scene);
  // Shared scenes remain unnamed until the user explicitly saves as a project.
  input.setCurrentProjectSession(null);
  input.setProjectAutosaveStatus("idle");
}
