import type { GraphObjectKind } from "@vinculum/scene/types";
import { CURRENT_SCENE_SCHEMA_VERSION, DEFAULT_SCENE_NAME, SCENE_DOCUMENT_VERSION } from "./sceneSchema";
import {
  MAX_SCENE_LABEL_LENGTH,
  MAX_SCENE_METADATA_NAME_LENGTH,
  MAX_SCENE_VERSION_LENGTH
} from "./importPayloadLimits";

export const SCENE_HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSceneVersion(value: unknown, errors: string[]): string {
  if (typeof value !== "string") {
    errors.push("version must be a string.");
    return SCENE_DOCUMENT_VERSION;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push("version cannot be empty.");
    return SCENE_DOCUMENT_VERSION;
  }
  if (trimmed.length > MAX_SCENE_VERSION_LENGTH) {
    errors.push(`version cannot exceed ${MAX_SCENE_VERSION_LENGTH} characters.`);
    return SCENE_DOCUMENT_VERSION;
  }

  return trimmed;
}

export function parseSceneSchemaVersion(value: unknown, errors: string[]): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push("schemaVersion must be an integer.");
    return CURRENT_SCENE_SCHEMA_VERSION;
  }

  if (value < 0) {
    errors.push("schemaVersion must be >= 0.");
    return CURRENT_SCENE_SCHEMA_VERSION;
  }

  return value;
}

export function parseSceneMetadata(value: unknown, errors: string[]): {
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

  if (name.length > MAX_SCENE_METADATA_NAME_LENGTH) {
    errors.push(`metadata.name cannot exceed ${MAX_SCENE_METADATA_NAME_LENGTH} characters.`);
  }

  return {
    name: name.length > MAX_SCENE_METADATA_NAME_LENGTH ? DEFAULT_SCENE_NAME : name,
    createdAt,
    updatedAt
  };
}

export function parseObjectKind(value: unknown, path: string, errors: string[]): GraphObjectKind | null {
  if (value === "surface" || value === "parametricCurve" || value === "plane") {
    return value;
  }

  errors.push(`${path} must be one of: surface, parametricCurve, plane.`);
  return null;
}

export function parseColor(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string" || !SCENE_HEX_COLOR_PATTERN.test(value.trim())) {
    errors.push(`${path} must be a hex color like #3b82f6.`);
    return null;
  }

  return value.trim().toLowerCase();
}

export function parseBoolean(value: unknown, path: string, errors: string[]): boolean | null {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean.`);
    return null;
  }

  return value;
}

export function parseFiniteNumber(value: unknown, path: string, errors: string[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return null;
  }

  return value;
}

export function parseInteger(
  value: unknown,
  path: string,
  errors: string[],
  min: number,
  max = Number.POSITIVE_INFINITY
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return null;
  }

  const normalized = Math.floor(value);
  if (normalized < min) {
    errors.push(`${path} must be >= ${min}.`);
    return null;
  }

  if (normalized > max) {
    errors.push(`${path} must be <= ${max}.`);
    return null;
  }

  return normalized;
}

export function parseMeasurementPoint(
  value: unknown,
  path: string,
  errors: string[]
): { x: number; y: number; z: number } | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const x = parseFiniteNumber(value.x, `${path}.x`, errors);
  const y = parseFiniteNumber(value.y, `${path}.y`, errors);
  const z = parseFiniteNumber(value.z, `${path}.z`, errors);
  if (x === null || y === null || z === null) {
    return null;
  }

  return { x, y, z };
}

export function requireString(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string.`);
    return null;
  }

  return value;
}

export function requireNonEmptyString(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string.`);
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push(`${path} cannot be empty.`);
    return null;
  }
  if (trimmed.length > MAX_SCENE_LABEL_LENGTH) {
    errors.push(`${path} cannot exceed ${MAX_SCENE_LABEL_LENGTH} characters.`);
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
