import { deserializeScene } from "@/lib/scene/deserializeScene";
import { validateSceneJsonTextLength } from "@/lib/scene/importPayloadLimits";
import { serializeScene } from "@/lib/scene/serializeScene";
import type { SceneDocument } from "@/lib/scene/sceneSchema";

const PROJECT_STORAGE_KEY = "vinculum-local-projects-v1";
const RECOVERY_STORAGE_KEY = "vinculum-unnamed-scene-recovery-v1";

interface StoredProjectsEnvelope {
  projects: StoredProjectDocument[];
}

interface StoredProjectDocument {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sceneSchemaVersion: number;
  sceneJson: string;
}

interface StoredRecoverySnapshot {
  schemaVersion: number;
  sceneJson: string;
  updatedAt: string;
  reason: "unnamed-scene-recovery";
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  objectCount: number;
  sceneSchemaVersion: number;
}

export interface ProjectDocument extends ProjectSummary {
  sceneJson: string;
}

export interface SaveProjectInput {
  projectId?: string;
  name: string;
  scene: SceneDocument;
}

export interface RecoverySnapshot {
  schemaVersion: number;
  sceneJson: string;
  updatedAt: string;
  reason: "unnamed-scene-recovery";
}

export class LocalProjectRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalProjectRepositoryError";
  }
}

export class LocalProjectRepository {
  listProjects(): ProjectSummary[] {
    const docs = this.readValidatedProjects();
    return docs
      .map((doc) => this.toSummary(doc))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  getProject(projectId: string): ProjectDocument | null {
    const docs = this.readValidatedProjects();
    const doc = docs.find((candidate) => candidate.id === projectId);
    if (!doc) {
      return null;
    }
    return this.toProjectDocument(doc);
  }

  saveProject(input: SaveProjectInput): ProjectDocument {
    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      throw new LocalProjectRepositoryError("Project name cannot be empty.");
    }

    const sceneJson = serializeScene(input.scene);
    const parsedScene = deserializeScene(sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Project save failed because the current scene is invalid: ${parsedScene.errors.join(" ")}`
      );
    }

    const docs = this.readValidatedProjects();
    const existing = input.projectId ? docs.find((candidate) => candidate.id === input.projectId) : null;
    const now = createUpdatedAt(existing?.updatedAt);

    const doc: StoredProjectDocument = {
      id: existing?.id ?? createProjectId(),
      name: trimmedName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sceneSchemaVersion: parsedScene.normalizedScene.schemaVersion,
      sceneJson
    };

    const nextDocs = existing
      ? docs.map((candidate) => (candidate.id === existing.id ? doc : candidate))
      : [doc, ...docs];

    this.writeProjects(nextDocs);
    return this.toProjectDocument(doc);
  }

  loadProjectScene(projectId: string): SceneDocument {
    const project = this.getProject(projectId);
    if (!project) {
      throw new LocalProjectRepositoryError("Project was not found. It may have been deleted.");
    }

    const parsedScene = deserializeScene(project.sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Project "${project.name}" is invalid and could not be loaded: ${parsedScene.errors.join(" ")}`
      );
    }

    return parsedScene.normalizedScene;
  }

  deleteProject(projectId: string): void {
    const docs = this.readValidatedProjects();
    const nextDocs = docs.filter((candidate) => candidate.id !== projectId);
    if (nextDocs.length === docs.length) {
      throw new LocalProjectRepositoryError("Project was not found. It may have been deleted already.");
    }
    this.writeProjects(nextDocs);
  }

  saveUnnamedRecoverySnapshot(scene: SceneDocument): RecoverySnapshot {
    const sceneJson = serializeScene(scene);
    const parsedScene = deserializeScene(sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Recovery snapshot save failed because the scene is invalid: ${parsedScene.errors.join(" ")}`
      );
    }

    const snapshot: StoredRecoverySnapshot = {
      schemaVersion: parsedScene.normalizedScene.schemaVersion,
      sceneJson,
      updatedAt: new Date().toISOString(),
      reason: "unnamed-scene-recovery"
    };

    const storage = getStorage();
    storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshot, null, 2));
    return snapshot;
  }

  getUnnamedRecoverySnapshot(): RecoverySnapshot | null {
    const storage = getStorage();
    const raw = storage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LocalProjectRepositoryError(
        "Recovery snapshot is corrupted. Discard it and continue."
      );
    }

    const snapshot = validateRecoverySnapshot(parsed);
    const parsedScene = deserializeScene(snapshot.sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Recovery snapshot is invalid and cannot be restored: ${parsedScene.errors.join(" ")}`
      );
    }

    return snapshot;
  }

  restoreUnnamedRecoverySnapshot(): SceneDocument {
    const snapshot = this.getUnnamedRecoverySnapshot();
    if (!snapshot) {
      throw new LocalProjectRepositoryError("Recovery snapshot was not found.");
    }

    const parsedScene = deserializeScene(snapshot.sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Recovery restore failed because snapshot data is invalid: ${parsedScene.errors.join(" ")}`
      );
    }

    return parsedScene.normalizedScene;
  }

  clearUnnamedRecoverySnapshot(): void {
    const storage = getStorage();
    storage.removeItem(RECOVERY_STORAGE_KEY);
  }

  private readValidatedProjects(): StoredProjectDocument[] {
    const raw = this.readRawEnvelope();
    return raw.projects.map((candidate, index) => validateStoredProject(candidate, index));
  }

  private readRawEnvelope(): StoredProjectsEnvelope {
    const storage = getStorage();
    const raw = storage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) {
      return { projects: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LocalProjectRepositoryError("Stored projects are corrupted. Clear local project storage and try again.");
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.projects)) {
      throw new LocalProjectRepositoryError("Stored projects payload is invalid. Clear local project storage and try again.");
    }

    return {
      projects: parsed.projects as unknown[]
    } as StoredProjectsEnvelope;
  }

  private writeProjects(projects: StoredProjectDocument[]): void {
    const storage = getStorage();
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ projects }, null, 2));
  }

  private toSummary(project: StoredProjectDocument): ProjectSummary {
    const parsedScene = deserializeScene(project.sceneJson);
    if (!parsedScene.valid || !parsedScene.normalizedScene) {
      throw new LocalProjectRepositoryError(
        `Stored project "${project.name}" is invalid: ${parsedScene.errors.join(" ")}`
      );
    }

    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      objectCount: parsedScene.normalizedScene.objects.length,
      sceneSchemaVersion: project.sceneSchemaVersion
    };
  }

  private toProjectDocument(project: StoredProjectDocument): ProjectDocument {
    const summary = this.toSummary(project);
    return {
      ...summary,
      sceneJson: project.sceneJson
    };
  }
}

export const localProjectRepository = new LocalProjectRepository();

function validateStoredProject(value: unknown, index: number): StoredProjectDocument {
  if (!isRecord(value)) {
    throw new LocalProjectRepositoryError(`Stored project at index ${index} is invalid.`);
  }

  const id = requireNonEmptyString(value.id, `projects[${index}].id`);
  const name = requireNonEmptyString(value.name, `projects[${index}].name`);
  const createdAt = requireIsoTimestamp(value.createdAt, `projects[${index}].createdAt`);
  const updatedAt = requireIsoTimestamp(value.updatedAt, `projects[${index}].updatedAt`);
  const sceneSchemaVersion = requireInteger(value.sceneSchemaVersion, `projects[${index}].sceneSchemaVersion`);
  const sceneJson = requireNonEmptyString(value.sceneJson, `projects[${index}].sceneJson`);
  const jsonLengthError = validateSceneJsonTextLength(sceneJson);
  if (jsonLengthError) {
    throw new LocalProjectRepositoryError(`projects[${index}].sceneJson is too large. ${jsonLengthError}`);
  }

  return {
    id,
    name,
    createdAt,
    updatedAt,
    sceneSchemaVersion,
    sceneJson
  };
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LocalProjectRepositoryError(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

function requireIsoTimestamp(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new LocalProjectRepositoryError(`${path} must be an ISO timestamp string.`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new LocalProjectRepositoryError(`${path} must be a valid timestamp.`);
  }
  return new Date(time).toISOString();
}

function requireInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new LocalProjectRepositoryError(`${path} must be an integer.`);
  }
  if (value < 0) {
    throw new LocalProjectRepositoryError(`${path} must be >= 0.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRecoverySnapshot(value: unknown): RecoverySnapshot {
  if (!isRecord(value)) {
    throw new LocalProjectRepositoryError("Recovery snapshot payload must be an object.");
  }

  const schemaVersion = requireInteger(value.schemaVersion, "recovery.schemaVersion");
  const sceneJson = requireNonEmptyString(value.sceneJson, "recovery.sceneJson");
  const jsonLengthError = validateSceneJsonTextLength(sceneJson);
  if (jsonLengthError) {
    throw new LocalProjectRepositoryError(`recovery.sceneJson is too large. ${jsonLengthError}`);
  }
  const updatedAt = requireIsoTimestamp(value.updatedAt, "recovery.updatedAt");
  const reason = requireNonEmptyString(value.reason, "recovery.reason");
  if (reason !== "unnamed-scene-recovery") {
    throw new LocalProjectRepositoryError(
      "Recovery snapshot reason is not supported."
    );
  }

  return {
    schemaVersion,
    sceneJson,
    updatedAt,
    reason
  };
}

function getStorage(): Storage {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    throw new LocalProjectRepositoryError("Local project storage is unavailable in this environment.");
  }
  return window.localStorage;
}

function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createUpdatedAt(previousUpdatedAt?: string): string {
  const now = Date.now();
  if (!previousUpdatedAt) {
    return new Date(now).toISOString();
  }

  const previous = Date.parse(previousUpdatedAt);
  if (!Number.isFinite(previous) || now > previous) {
    return new Date(now).toISOString();
  }

  return new Date(previous + 1).toISOString();
}
