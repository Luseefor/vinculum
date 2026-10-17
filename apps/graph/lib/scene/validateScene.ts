import type { GraphObject } from "@vinculum/scene/types";
import {
  cloneSceneMeasurement,
  createSceneDocument,
  CURRENT_SCENE_SCHEMA_VERSION,
  SCENE_DOCUMENT_VERSION,
  type SceneParameter,
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
  MAX_SCENE_OBJECT_COUNT,
  MAX_SCENE_PARAMETER_COUNT,
  MAX_SCENE_PARAMETER_NAME_LENGTH
} from "./importPayloadLimits";

import { completeSceneParameters, getSceneParameterNames } from "./sceneParameters";
import { isParameterName, parametersToScope } from "@/lib/store/editorParameters";
import { resolveObjectCombinations } from "@/lib/math/geometry/objectOperations";

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

  const parameters = completeSceneParameters(migratedInput.objects, parseSceneParameters(migratedInput.parameters, errors));
  if (parameters.length > MAX_SCENE_PARAMETER_COUNT) errors.push(`parameters cannot exceed ${MAX_SCENE_PARAMETER_COUNT}.`);
  const parameterScope = parametersToScope(parameters);
  const normalizedObjects: GraphObject[] = [];
  const seenObjectIds = new Set<string>();

  migratedInput.objects.forEach((rawObject, objectIndex) => {
    const previousErrorCount = errors.length;
    const parsedObject = parseGraphObject(rawObject, objectIndex, errors, parameterScope);
    if (!parsedObject || (parsedObject.kind === "implicitCurve" && !parsedObject.equation.trim())) {
      if (errors.length === previousErrorCount) {
        errors.push(`objects[${objectIndex}] has an incomplete definition. Finish it or remove the object before saving, exporting, or sharing.`);
      }
      return;
    }
    if (parsedObject) {
      // S29-R7: duplicate object IDs alias scene nodes (selection, worker
      // generations keyed by ID, overlay namespaces). Reject fail-closed
      // instead of silently aliasing two nodes.
      if (seenObjectIds.has(parsedObject.id)) {
        errors.push(`objects[${objectIndex}].id must be unique. Duplicate id "${parsedObject.id}".`);
        return;
      }
      seenObjectIds.add(parsedObject.id);
      normalizedObjects.push(parsedObject);
    }
  });

  const normalizedMeasurements = parseSceneMeasurements(migratedInput.measurements, errors);
  const resolvedObjects = resolveObjectCombinations(normalizedObjects, parameterScope, errors, true);

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
      objects: resolvedObjects,
      measurements: normalizedMeasurements,
      parameters
    })
  };
}

type MigrationStep = (document: Record<string, unknown>) => Record<string, unknown>;

const SCENE_DOCUMENT_MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateSceneDocumentV0ToV1,
  1: migrateSceneDocumentV1ToV2,
  2: document => ({ ...document, schemaVersion: 3 }),
  3: document => ({ ...document, schemaVersion: 4 })
};

export function migrateSceneDocumentEnvelope(input: Record<string, unknown>):
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

function migrateSceneDocumentV1ToV2(document: Record<string, unknown>): Record<string, unknown> {
  // Older documents stored symbols but no scalar scope. Missing values have
  // a deterministic default; local session upgrades can recover editor values.
  const objects = Array.isArray(document.objects) ? document.objects : [];
  const parameters = document.parameters === undefined
    ? getSceneParameterNames(objects).map(id => ({ id, value: 1, min: -10, max: 10 }))
    : document.parameters;
  return { ...document, schemaVersion: 2, parameters };
}

export function parseSceneParameters(value: unknown, errors: string[]): SceneParameter[] {
  if (!Array.isArray(value)) {
    errors.push("parameters must be an array.");
    return [];
  }
  if (value.length > MAX_SCENE_PARAMETER_COUNT) {
    errors.push(`parameters cannot exceed ${MAX_SCENE_PARAMETER_COUNT}.`);
    return [];
  }
  const entries: SceneParameter[] = [];
  const ids = new Set<string>();
  value.forEach((raw, index) => {
    const path = `parameters[${index}]`;
    if (!isRecord(raw)) { errors.push(`${path} must be an object.`); return; }
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!isParameterName(id) || id.length > MAX_SCENE_PARAMETER_NAME_LENGTH) {
      errors.push(`${path}.id must be a scalar parameter name of at most ${MAX_SCENE_PARAMETER_NAME_LENGTH} characters.`);
      return;
    }
    if (ids.has(id)) { errors.push(`${path}.id must be unique.`); return; }
    ids.add(id);
    if (![raw.value, raw.min, raw.max].every(number => typeof number === "number" && Number.isFinite(number))) {
      errors.push(`${path} value, min and max must be finite numbers.`);
      return;
    }
    const { value, min, max } = raw as { value: number; min: number; max: number };
    if (min >= max || value < min || value > max) {
      errors.push(`${path} requires min < max and a value inside those bounds.`);
      return;
    }
    if (raw.defined !== undefined && typeof raw.defined !== "boolean") {
      errors.push(`${path}.defined must be a boolean.`);
      return;
    }
    entries.push({ id, value, min, max, ...(raw.defined !== undefined ? { defined: raw.defined as boolean } : {}) });
  });
  return entries;
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
  const seenMeasurementIds = new Set<string>();

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
    // S29-R7: duplicate measurement IDs alias probe pins/selection.
    if (seenMeasurementIds.has(id)) {
      errors.push(`${path}.id must be unique. Duplicate id "${id}".`);
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
      seenMeasurementIds.add(id);
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
      seenMeasurementIds.add(id);
      return;
    }

    errors.push(`${path}.kind must be one of: distance, angle, pin.`);
  });

  return normalized;
}

function rejectUnsupportedTopLevelKeys(document: Record<string, unknown>, errors: string[]): void {
  const allowedKeys = new Set(["schemaVersion", "version", "metadata", "objects", "measurements", "parameters"]);

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
