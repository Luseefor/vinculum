import { cloneSceneDocument, type SceneDocument } from "./sceneSchema";

export function serializeScene(scene: SceneDocument): string {
  const serializableScene = cloneSceneDocument(scene);
  return JSON.stringify(serializableScene, null, 2);
}
