import type { GraphObject, GraphObjectKind, ParametricCurveObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { createSceneDocument, DEFAULT_SCENE_NAME, SCENE_DOCUMENT_VERSION, type SceneDocument } from "./sceneSchema";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

  const version = parseVersion(input.version, errors);
  const metadata = parseMetadata(input.metadata, errors);

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

function parseGraphObject(rawObject: unknown, objectIndex: number, errors: string[]): GraphObject | null {
  if (!isRecord(rawObject)) {
    errors.push(`objects[${objectIndex}] must be an object.`);
    return null;
  }

  const id = requireNonEmptyString(rawObject.id, `objects[${objectIndex}].id`, errors);
  const kind = parseObjectKind(rawObject.kind, `objects[${objectIndex}].kind`, errors);
  const color = parseColor(rawObject.color, `objects[${objectIndex}].color`, errors);
  const visible = parseBoolean(rawObject.visible, `objects[${objectIndex}].visible`, errors);

  if (!id || !kind || !color || visible === null) {
    return null;
  }

  if (kind === "surface") {
    return parseSurfaceGraphObject(rawObject, objectIndex, id, color, visible, errors);
  }

  if (kind === "parametricCurve") {
    return parseParametricCurveObject(rawObject, objectIndex, id, color, visible, errors);
  }

  return parsePlaneGraphObject(rawObject, objectIndex, id, color, visible, errors);
}

function parseSurfaceGraphObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): SurfaceGraphObject | null {
  const equation = requireString(rawObject.equation, `objects[${objectIndex}].equation`, errors);

  const domainPath = `objects[${objectIndex}].domain`;
  if (!isRecord(rawObject.domain)) {
    errors.push(`${domainPath} must be an object.`);
    return null;
  }

  const xMin = parseFiniteNumber(rawObject.domain.xMin, `${domainPath}.xMin`, errors);
  const xMax = parseFiniteNumber(rawObject.domain.xMax, `${domainPath}.xMax`, errors);
  const yMin = parseFiniteNumber(rawObject.domain.yMin, `${domainPath}.yMin`, errors);
  const yMax = parseFiniteNumber(rawObject.domain.yMax, `${domainPath}.yMax`, errors);

  const resolution = parseInteger(rawObject.resolution, `objects[${objectIndex}].resolution`, errors, 2);

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (!equation || xMin === null || xMax === null || yMin === null || yMax === null || resolution === null || wireframe === null) {
    return null;
  }

  return {
    id,
    kind: "surface",
    equation,
    visible,
    color,
    domain: {
      xMin,
      xMax,
      yMin,
      yMax
    },
    resolution,
    appearance: {
      wireframe
    }
  };
}

function parseParametricCurveObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): ParametricCurveObject | null {
  const xExpr = requireString(rawObject.xExpr, `objects[${objectIndex}].xExpr`, errors);
  const yExpr = requireString(rawObject.yExpr, `objects[${objectIndex}].yExpr`, errors);
  const zExpr = requireString(rawObject.zExpr, `objects[${objectIndex}].zExpr`, errors);
  const tMin = parseFiniteNumber(rawObject.tMin, `objects[${objectIndex}].tMin`, errors);
  const tMax = parseFiniteNumber(rawObject.tMax, `objects[${objectIndex}].tMax`, errors);
  const samples = parseInteger(rawObject.samples, `objects[${objectIndex}].samples`, errors, 2);

  if (!xExpr || !yExpr || !zExpr || tMin === null || tMax === null || samples === null) {
    return null;
  }

  return {
    id,
    kind: "parametricCurve",
    xExpr,
    yExpr,
    zExpr,
    tMin,
    tMax,
    samples,
    color,
    visible
  };
}

function parsePlaneGraphObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): PlaneGraphObject | null {
  const equation = requireString(rawObject.equation, `objects[${objectIndex}].equation`, errors);
  const size = parseInteger(rawObject.size, `objects[${objectIndex}].size`, errors, 1);

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (!equation || size === null || wireframe === null) {
    return null;
  }

  return {
    id,
    kind: "plane",
    equation,
    size,
    color,
    visible,
    appearance: {
      wireframe
    }
  };
}

function parseVersion(value: unknown, errors: string[]): string {
  if (typeof value !== "string") {
    errors.push("version must be a string.");
    return SCENE_DOCUMENT_VERSION;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push("version cannot be empty.");
    return SCENE_DOCUMENT_VERSION;
  }

  return trimmed;
}

function parseMetadata(value: unknown, errors: string[]): {
  name: string;
  createdAt: string;
  updatedAt: string;
} {
  if (!isRecord(value)) {
    errors.push("metadata must be an object.");
    const now = new Date().toISOString();
    return {
      name: DEFAULT_SCENE_NAME,
      createdAt: now,
      updatedAt: now
    };
  }

  const name = requireNonEmptyString(value.name, "metadata.name", errors) ?? DEFAULT_SCENE_NAME;
  const createdAt = parseIsoTimestamp(value.createdAt, "metadata.createdAt", errors) ?? new Date().toISOString();
  const updatedAt = parseIsoTimestamp(value.updatedAt, "metadata.updatedAt", errors) ?? createdAt;

  return {
    name,
    createdAt,
    updatedAt
  };
}

function parseObjectKind(value: unknown, path: string, errors: string[]): GraphObjectKind | null {
  if (value === "surface" || value === "parametricCurve" || value === "plane") {
    return value;
  }

  errors.push(`${path} must be one of: surface, parametricCurve, plane.`);
  return null;
}

function parseColor(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value.trim())) {
    errors.push(`${path} must be a hex color like #3b82f6.`);
    return null;
  }

  return value.trim().toLowerCase();
}

function parseBoolean(value: unknown, path: string, errors: string[]): boolean | null {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean.`);
    return null;
  }

  return value;
}

function parseFiniteNumber(value: unknown, path: string, errors: string[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return null;
  }

  return value;
}

function parseInteger(value: unknown, path: string, errors: string[], min: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return null;
  }

  const normalized = Math.floor(value);
  if (normalized < min) {
    errors.push(`${path} must be >= ${min}.`);
    return null;
  }

  return normalized;
}

function requireString(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string.`);
    return null;
  }

  return value;
}

function requireNonEmptyString(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string.`);
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push(`${path} cannot be empty.`);
    return null;
  }

  return trimmed;
}

function parseIsoTimestamp(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${path} must be an ISO timestamp string.`);
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    errors.push(`${path} must be a valid timestamp.`);
    return null;
  }

  return new Date(timestamp).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
