import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import {
  LocalProjectRepository,
  LocalProjectRepositoryError
} from "@/lib/projects/localProjectRepository";
import { createSceneDocument, CURRENT_SCENE_SCHEMA_VERSION } from "@/lib/scene/sceneSchema";
import { MAX_SCENE_JSON_LENGTH } from "@/lib/scene/importPayloadLimits";

const STORAGE_KEY = "vinculum-local-projects-v1";

describe("LocalProjectRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves a named project and preserves scene schema version metadata", () => {
    const repository = new LocalProjectRepository();
    const scene = createSceneDocument({
      metadata: {
        name: "Project Scene",
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-1", equation: "x+y" })]
    });

    const saved = repository.saveProject({
      name: "Project One",
      scene
    });

    expect(saved.id.length).toBeGreaterThan(0);
    expect(saved.name).toBe("Project One");
    expect(saved.sceneSchemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
  });

  it("lists recent projects sorted by updatedAt descending", () => {
    vi.useFakeTimers();
    const repository = new LocalProjectRepository();
    const first = createSceneDocument({
      metadata: {
        name: "First",
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      },
      objects: []
    });
    const second = createSceneDocument({
      metadata: {
        name: "Second",
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-2", equation: "x-y" })]
    });

    vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));
    const projectA = repository.saveProject({ name: "A", scene: first });
    vi.setSystemTime(new Date("2026-01-10T00:00:01.000Z"));
    const projectB = repository.saveProject({ name: "B", scene: second });
    vi.setSystemTime(new Date("2026-01-10T00:00:02.000Z"));
    const updatedA = repository.saveProject({
      projectId: projectA.id,
      name: "A",
      scene: second
    });

    const listed = repository.listProjects();

    expect(listed[0]?.id).toBe(updatedA.id);
    expect(listed[1]?.id).toBe(projectB.id);
    vi.useRealTimers();
  });

  it("loads project scene through canonical deserialization and validation", () => {
    const repository = new LocalProjectRepository();
    const scene = createSceneDocument({
      metadata: {
        name: "Load Test",
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-load", equation: "x*y" })]
    });
    const saved = repository.saveProject({ name: "Loadable", scene });

    const loaded = repository.loadProjectScene(saved.id);

    expect(loaded.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(loaded.objects).toHaveLength(1);
    expect(loaded.metadata.name).toBe("Load Test");
  });

  it("deletes saved projects", () => {
    const repository = new LocalProjectRepository();
    const scene = createSceneDocument({ objects: [] });
    const saved = repository.saveProject({ name: "Disposable", scene });

    repository.deleteProject(saved.id);

    expect(repository.getProject(saved.id)).toBeNull();
    expect(repository.listProjects()).toHaveLength(0);
  });

  it("rejects invalid stored project payloads safely", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: [
          {
            id: "bad-project",
            name: "Broken",
            createdAt: "2026-01-10T00:00:00.000Z",
            updatedAt: "2026-01-10T00:00:00.000Z",
            sceneSchemaVersion: CURRENT_SCENE_SCHEMA_VERSION,
            sceneJson: "{invalid-json"
          }
        ]
      })
    );

    const repository = new LocalProjectRepository();

    expect(() => repository.listProjects()).toThrow(LocalProjectRepositoryError);
  });

  it("rejects invalid project restore payloads safely", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: [
          {
            id: "bad-restore-project",
            name: "Broken Restore",
            createdAt: "2026-01-10T00:00:00.000Z",
            updatedAt: "2026-01-10T00:00:00.000Z",
            sceneSchemaVersion: CURRENT_SCENE_SCHEMA_VERSION,
            sceneJson: "{invalid-json"
          }
        ]
      })
    );

    const repository = new LocalProjectRepository();
    expect(() => repository.loadProjectScene("bad-restore-project")).toThrow(LocalProjectRepositoryError);
  });

  it("writes and restores unnamed recovery snapshots", () => {
    const repository = new LocalProjectRepository();
    const scene = createSceneDocument({
      metadata: {
        name: "Recovery Scene",
        createdAt: "2026-01-10T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-recovery", equation: "x+y" })]
    });

    repository.saveUnnamedRecoverySnapshot(scene);
    const restored = repository.restoreUnnamedRecoverySnapshot();

    expect(restored.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(restored.objects).toHaveLength(1);
  });

  it("fails safely when recovery snapshot payload is invalid", () => {
    window.localStorage.setItem(
      "vinculum-unnamed-scene-recovery-v1",
      JSON.stringify({
        schemaVersion: CURRENT_SCENE_SCHEMA_VERSION,
        sceneJson: "{broken-json",
        updatedAt: "2026-01-10T00:00:00.000Z",
        reason: "unnamed-scene-recovery"
      })
    );

    const repository = new LocalProjectRepository();
    expect(() => repository.getUnnamedRecoverySnapshot()).toThrow(LocalProjectRepositoryError);
  });

  it("fails safely when recovery snapshot scene payload is oversized", () => {
    window.localStorage.setItem(
      "vinculum-unnamed-scene-recovery-v1",
      JSON.stringify({
        schemaVersion: CURRENT_SCENE_SCHEMA_VERSION,
        sceneJson: "x".repeat(MAX_SCENE_JSON_LENGTH + 1),
        updatedAt: "2026-01-10T00:00:00.000Z",
        reason: "unnamed-scene-recovery"
      })
    );

    const repository = new LocalProjectRepository();
    expect(() => repository.getUnnamedRecoverySnapshot()).toThrow(LocalProjectRepositoryError);
  });

  it("discarding recovery removes snapshot", () => {
    const repository = new LocalProjectRepository();
    repository.saveUnnamedRecoverySnapshot(createSceneDocument({ objects: [] }));

    repository.clearUnnamedRecoverySnapshot();

    expect(repository.getUnnamedRecoverySnapshot()).toBeNull();
  });

  it("save-as flow clears unnamed recovery snapshot", () => {
    const repository = new LocalProjectRepository();
    repository.saveUnnamedRecoverySnapshot(
      createSceneDocument({
        metadata: {
          name: "Unsaved",
          createdAt: "2026-01-10T00:00:00.000Z",
          updatedAt: "2026-01-10T00:00:00.000Z"
        },
        objects: [createSurfaceGraph({ id: "surface-unsaved", equation: "x" })]
      })
    );

    repository.saveProject({
      name: "Named project",
      scene: createSceneDocument({
        metadata: {
          name: "Named",
          createdAt: "2026-01-10T00:00:00.000Z",
          updatedAt: "2026-01-10T00:00:00.000Z"
        },
        objects: [createSurfaceGraph({ id: "surface-named", equation: "y" })]
      })
    });
    repository.clearUnnamedRecoverySnapshot();

    expect(repository.getUnnamedRecoverySnapshot()).toBeNull();
  });
});
