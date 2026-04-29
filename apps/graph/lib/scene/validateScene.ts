import type { GraphObject } from "@vinculum/scene/types";
import {
  cloneSceneMeasurement,
  createSceneDocument,
  CURRENT_SCENE_SCHEMA_VERSION,
  SCENE_DOCUMENT_VERSION,
  type SceneMeasurement,
  type SceneDocument
} from "./sceneSchema";
import { parseGraphObject } from "./validateSceneGraphParsers";
import {
  isRecord,
  parseSceneMetadata,
  parseSceneSchemaVersion,
  parseSceneVersion,
  parseMeasurementPoint
} from "./validateScenePrimitives";
import {
  MAX_SCENE_CONSTRAINT_COUNT,
  MAX_SCENE_GROUP_COUNT,
  MAX_SCENE_MEASUREMENT_COUNT,
  MAX_SCENE_OBJECT_COUNT
} from "./importPayloadLimits";

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

  const migrationResult = migrateSceneDocumentEnvelope(input);
  if (!migrationResult.ok) {
    return {
      valid: false,
      errors: migrationResult.errors
    };
  }

  const migratedInput = migrationResult.document;
  rejectUnsupportedTopLevelKeys(migratedInput, errors);

  const schemaVersion = parseSceneSchemaVersion(migratedInput.schemaVersion, errors);
  if (schemaVersion !== CURRENT_SCENE_SCHEMA_VERSION) {
    errors.push(
      `Scene schema version ${schemaVersion} is not supported. Expected schema version ${CURRENT_SCENE_SCHEMA_VERSION}.`
    );
  }
  const version = parseSceneVersion(migratedInput.version, errors);
  const metadata = parseSceneMetadata(migratedInput.metadata, errors);

  if (!Array.isArray(migratedInput.objects)) {
    errors.push("objects must be an array.");
    return {
      valid: false,
      errors
    };
  }
  if (migratedInput.objects.length > MAX_SCENE_OBJECT_COUNT) {
    errors.push(`objects cannot exceed ${MAX_SCENE_OBJECT_COUNT}.`);
    return {
      valid: false,
      errors
    };
  }

  const normalizedObjects: GraphObject[] = [];

  migratedInput.objects.forEach((rawObject, objectIndex) => {
    const parsedObject = parseGraphObject(rawObject, objectIndex, errors);
    if (parsedObject) {
      normalizedObjects.push(parsedObject);
    }
  });

  const normalizedMeasurements = parseSceneMeasurements(migratedInput.measurements, errors);

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
      // createSceneDocument normalizes to current schema version.
      version,
      metadata,
      objects: normalizedObjects,
      measurements: normalizedMeasurements
    })
  };
}

type MigrationStep = (document: Record<string, unknown>) => Record<string, unknown>;

const SCENE_DOCUMENT_MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateSceneDocumentV0ToV1
};

function migrateSceneDocumentEnvelope(input: Record<string, unknown>):
  | { ok: true; document: Record<string, unknown> }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const startingVersion = inferSceneSchemaVersion(input, errors);

  if (errors.length > 0 || startingVersion === null) {
    return { ok: false, errors };
  }

  if (startingVersion > CURRENT_SCENE_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Unsupported scene schema version ${startingVersion}. This editor supports up to schema version ${CURRENT_SCENE_SCHEMA_VERSION}. Export this scene from a compatible version or upgrade Vinculum.`
      ]
    };
  }

  let nextDocument = { ...input };
  let cursorVersion = startingVersion;

  while (cursorVersion < CURRENT_SCENE_SCHEMA_VERSION) {
    const migrateStep = SCENE_DOCUMENT_MIGRATIONS[cursorVersion];
    if (!migrateStep) {
      return {
        ok: false,
        errors: [
          `Scene schema version ${cursorVersion} cannot be migrated automatically. Re-export the scene from a newer Vinculum version and try again.`
        ]
      };
    }

    nextDocument = migrateStep(nextDocument);
    cursorVersion += 1;
  }

  return { ok: true, document: nextDocument };
}

function inferSceneSchemaVersion(input: Record<string, unknown>, errors: string[]): number | null {
  const rawSchemaVersion = input.schemaVersion;
  if (typeof rawSchemaVersion === "undefined") {
    // Legacy schema: version field existed before schemaVersion.
    return 0;
  }

  if (typeof rawSchemaVersion !== "number" || !Number.isInteger(rawSchemaVersion)) {
    errors.push("schemaVersion must be an integer when provided.");
    return null;
  }

  if (rawSchemaVersion < 0) {
    errors.push("schemaVersion must be >= 0.");
    return null;
  }

  return rawSchemaVersion;
}

function migrateSceneDocumentV0ToV1(document: Record<string, unknown>): Record<string, unknown> {
  const nextVersion =
    typeof document.version === "string" && document.version.trim().length > 0
      ? document.version.trim()
      : SCENE_DOCUMENT_VERSION;

  return {
    ...document,
    schemaVersion: 1,
    version: nextVersion,
    measurements: Array.isArray(document.measurements) ? document.measurements : []
  };
}

function parseSceneMeasurements(value: unknown, errors: string[]): SceneMeasurement[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push("measurements must be an array when provided.");
    return [];
  }
  if (value.length > MAX_SCENE_MEASUREMENT_COUNT) {
    errors.push(`measurements cannot exceed ${MAX_SCENE_MEASUREMENT_COUNT}.`);
    return [];
  }

  const normalized: SceneMeasurement[] = [];

  value.forEach((rawMeasurement, index) => {
    const path = `measurements[${index}]`;
    if (!isRecord(rawMeasurement)) {
      errors.push(`${path} must be an object.`);
      return;
    }

    const id = typeof rawMeasurement.id === "string" ? rawMeasurement.id.trim() : "";
    if (id.length === 0) {
      errors.push(`${path}.id must be a non-empty string.`);
      return;
    }

    const kind = rawMeasurement.kind;
    if (kind === "pin") {
      const point = parseMeasurementPoint(rawMeasurement.point, `${path}.point`, errors);
      if (!point) {
        return;
      }

      const label =
        typeof rawMeasurement.label === "string" && rawMeasurement.label.trim().length > 0
          ? rawMeasurement.label.trim()
          : undefined;
      normalized.push({
        id,
        kind: "pin",
        point,
        label
      });
      return;
    }

    if (kind === "distance" || kind === "angle") {
      if (!Array.isArray(rawMeasurement.points)) {
        errors.push(`${path}.points must be an array.`);
        return;
      }

      const expected = kind === "distance" ? 2 : 3;
      if (rawMeasurement.points.length !== expected) {
        errors.push(`${path}.points must include exactly ${expected} points.`);
        return;
      }

      const points = rawMeasurement.points
        .map((point, pointIndex) => parseMeasurementPoint(point, `${path}.points[${pointIndex}]`, errors))
        .filter((point): point is { x: number; y: number; z: number } => point !== null);

      if (points.length !== expected) {
        return;
      }

      normalized.push(
        cloneSceneMeasurement(
          kind === "distance"
            ? {
                id,
                kind,
                points: [points[0], points[1]]
              }
            : {
                id,
                kind,
                points: [points[0], points[1], points[2]]
              }
        )
      );
      return;
    }

    errors.push(`${path}.kind must be one of: distance, angle, pin.`);
  });

  return normalized;
}

function rejectUnsupportedTopLevelKeys(document: Record<string, unknown>, errors: string[]): void {
  const allowedKeys = new Set(["schemaVersion", "version", "metadata", "objects", "measurements"]);

  if ("groups" in document) {
    const groups = document.groups;
    if (!Array.isArray(groups)) {
      errors.push("groups must be an array when provided.");
    } else if (groups.length > MAX_SCENE_GROUP_COUNT) {
      errors.push(`groups cannot exceed ${MAX_SCENE_GROUP_COUNT}.`);
    } else {
      errors.push("groups are not supported by this scene schema.");
    }
  }

  if ("constraints" in document) {
    const constraints = document.constraints;
    if (!Array.isArray(constraints)) {
      errors.push("constraints must be an array when provided.");
    } else if (constraints.length > MAX_SCENE_CONSTRAINT_COUNT) {
      errors.push(`constraints cannot exceed ${MAX_SCENE_CONSTRAINT_COUNT}.`);
    } else {
      errors.push("constraints are not supported by this scene schema.");
    }
  }

  for (const key of Object.keys(document)) {
    if (!allowedKeys.has(key) && key !== "groups" && key !== "constraints") {
      errors.push(`Unsupported top-level field "${key}".`);
    }
  }
}
