import type { GraphObject } from "@vinculum/scene/types";
import { createSceneDocument, type SceneDocument } from "./sceneSchema";
import { parseGraphObject } from "./validateSceneGraphParsers";
import { isRecord, parseSceneMetadata, parseSceneVersion } from "./validateScenePrimitives";

export interface SceneValidationResult {
  valid: boolean;
  errors: string[];
  normalizedScene?: SceneDocument;
}

export function validateSceneDocument(input: unknown): SceneValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ["Scene document must be a JSON object."]
    };
  }

  const version = parseSceneVersion(input.version, errors);
  const metadata = parseSceneMetadata(input.metadata, errors);

  if (!Array.isArray(input.objects)) {
    errors.push("objects must be an array.");
    return {
      valid: false,
      errors
    };
  }

  const normalizedObjects: GraphObject[] = [];

  input.objects.forEach((rawObject, objectIndex) => {
    const parsedObject = parseGraphObject(rawObject, objectIndex, errors);
    if (parsedObject) {
      normalizedObjects.push(parsedObject);
    }
  });

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    errors: [],
    normalizedScene: createSceneDocument({
      version,
      metadata,
      objects: normalizedObjects
    })
  };
}
