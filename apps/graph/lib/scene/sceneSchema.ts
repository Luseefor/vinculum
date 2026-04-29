import type { GraphObject } from "@vinculum/scene/types";

export const SCENE_DOCUMENT_VERSION = "1.0";
export const CURRENT_SCENE_SCHEMA_VERSION = 1;
export const DEFAULT_SCENE_NAME = "Untitled Scene";

export interface SceneMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneDocument {
  schemaVersion: number;
  version: string;
  metadata: SceneMetadata;
  objects: GraphObject[];
}

interface CreateSceneDocumentOptions {
  version?: string;
  metadata?: Partial<SceneMetadata>;
  objects?: GraphObject[];
  now?: string;
}

export function createSceneDocument(options: CreateSceneDocumentOptions = {}): SceneDocument {
  const now = normalizeIsoTimestamp(options.now) ?? new Date().toISOString();
  const metadata = createSceneMetadata(options.metadata, now);

  return {
    version: normalizeVersion(options.version),
    metadata,
    objects: (options.objects ?? []).map(cloneGraphObject)
  };
}

export function createSceneMetadata(metadata: Partial<SceneMetadata> = {}, fallbackNow?: string): SceneMetadata {
  const now = normalizeIsoTimestamp(fallbackNow) ?? new Date().toISOString();
  const createdAt = normalizeIsoTimestamp(metadata.createdAt) ?? now;
  const updatedAt = normalizeIsoTimestamp(metadata.updatedAt) ?? createdAt;

  return {
    name: normalizeName(metadata.name),
    createdAt,
    updatedAt
  };
}

export function cloneSceneDocument(scene: SceneDocument): SceneDocument {
  return createSceneDocument({
    version: scene.version,
    metadata: {
      name: scene.metadata.name,
      createdAt: scene.metadata.createdAt,
      updatedAt: scene.metadata.updatedAt
    },
    objects: scene.objects
  });
}

export function cloneGraphObject(object: GraphObject): GraphObject {
  if (object.kind === "surface") {
    return {
      ...object,
      domain: {
        ...object.domain
      },
      appearance: {
        ...object.appearance
      }
    };
  }

  if (object.kind === "parametricCurve") {
    return {
      ...object
    };
  }

  return {
    ...object,
    appearance: {
      ...object.appearance
    }
  };
}

function normalizeVersion(version: string | undefined): string {
  if (typeof version !== "string") {
    return SCENE_DOCUMENT_VERSION;
  }

  const trimmed = version.trim();
  return trimmed.length > 0 ? trimmed : SCENE_DOCUMENT_VERSION;
}

function normalizeName(name: string | undefined): string {
  if (typeof name !== "string") {
    return DEFAULT_SCENE_NAME;
  }

  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SCENE_NAME;
}

function normalizeIsoTimestamp(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}
