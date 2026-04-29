import type { SceneDocument } from "@/lib/scene/sceneSchema";

interface ApplySceneExampleInput {
  scene: SceneDocument;
  recommendedMode: "2d" | "3d";
  clearHistory: () => void;
  replaceSceneDocument: (scene: SceneDocument) => void;
  setGraphMode: (mode: "2d" | "3d") => void;
  setCurrentProjectSession: (project: { id: string; name: string } | null) => void;
  setProjectAutosaveStatus: (
    status: "idle" | "dirty" | "saving" | "saved" | "error",
    error?: string | null
  ) => void;
}

export function applySceneExampleToEditor(input: ApplySceneExampleInput): void {
  input.clearHistory();
  input.replaceSceneDocument(input.scene);
  input.setGraphMode(input.recommendedMode);
  input.setCurrentProjectSession(null);
  input.setProjectAutosaveStatus("idle");
}
