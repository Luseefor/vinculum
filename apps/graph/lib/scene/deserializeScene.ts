import { validateSceneDocument, type SceneValidationResult } from "./validateScene";
import { reportWarning } from "@/lib/monitoring/errorReporting";
import { validatePayloadDepthAndNodes, validateSceneJsonTextLength } from "./importPayloadLimits";

export function deserializeScene(json: string): SceneValidationResult {
  if (typeof json !== "string") {
    reportWarning("Scene import rejected because payload is not JSON text.", {
      featureArea: "scene-import",
      operation: "deserialize-type-check"
    });
    return {
      valid: false,
      errors: ["Scene import requires JSON text."]
    };
  }

  const sizeError = validateSceneJsonTextLength(json);
  if (sizeError) {
    reportWarning("Scene import rejected because payload exceeds size limits.", {
      featureArea: "scene-import",
      operation: "deserialize-size-check"
    });
    return {
      valid: false,
      errors: [sizeError]
    };
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    const depthError = validatePayloadDepthAndNodes(parsed);
    if (depthError) {
      reportWarning("Scene import rejected because payload depth or complexity is unsafe.", {
        featureArea: "scene-import",
        operation: "deserialize-depth-check"
      });
      return {
        valid: false,
        errors: [depthError]
      };
    }
    return validateSceneDocument(parsed);
  } catch {
    reportWarning("Scene import failed due to malformed JSON.", {
      featureArea: "scene-import",
      operation: "deserialize-json-parse"
    });
    return {
      valid: false,
      errors: ["Invalid JSON. Check for missing commas, quotes, or brackets."]
    };
  }
}
