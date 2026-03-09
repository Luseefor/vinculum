import { validateSceneDocument, type SceneValidationResult } from "./validateScene";

export function deserializeScene(json: string): SceneValidationResult {
  if (typeof json !== "string") {
    return {
      valid: false,
      errors: ["Scene import requires JSON text."]
    };
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    return validateSceneDocument(parsed);
  } catch {
    return {
      valid: false,
      errors: ["Invalid JSON. Check for missing commas, quotes, or brackets."]
    };
  }
}
