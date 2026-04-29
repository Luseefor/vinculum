import { describe, expect, it, vi } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";
import { ProjectAutosaveController } from "@/lib/projects/projectAutosave";
import { serializeScene } from "@/lib/scene/serializeScene";
import { createSceneDocument } from "@/lib/scene/sceneSchema";

describe("ProjectAutosaveController", () => {
  it("autosaves updates existing project without creating duplicates", () => {
    vi.useFakeTimers();
    const repository = new LocalProjectRepository();
    const baseScene = createSceneDocument({
      metadata: {
        name: "Base",
        createdAt: "2026-01-11T00:00:00.000Z",
        updatedAt: "2026-01-11T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-base", equation: "x" })]
    });
    const saved = repository.saveProject({ name: "Project A", scene: baseScene });
    const initialUpdatedAt = saved.updatedAt;

    const callbacks = {
      onDirty: vi.fn(),
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn()
    };
    const controller = new ProjectAutosaveController(repository, callbacks, 500);
    const changedScene = createSceneDocument({
      metadata: {
        name: "Changed",
        createdAt: "2026-01-11T00:00:00.000Z",
        updatedAt: "2026-01-11T00:00:01.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-changed", equation: "x+y" })]
    });

    controller.scheduleProjectAutosave({
      projectId: saved.id,
      projectName: saved.name,
      scene: changedScene
    });
    vi.advanceTimersByTime(500);

    const listed = repository.listProjects();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(saved.id);
    expect(Date.parse(listed[0]?.updatedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(initialUpdatedAt));
    expect(callbacks.onDirty).toHaveBeenCalledTimes(1);
    expect(callbacks.onSaving).toHaveBeenCalledTimes(1);
    expect(callbacks.onSaved).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("autosave writes scene JSON via canonical serialization shape", () => {
    vi.useFakeTimers();
    const repository = new LocalProjectRepository();
    const saved = repository.saveProject({
      name: "Project B",
      scene: createSceneDocument({ objects: [] })
    });
    const changedScene = createSceneDocument({
      metadata: {
        name: "Serialized",
        createdAt: "2026-01-11T00:00:00.000Z",
        updatedAt: "2026-01-11T00:00:02.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-serialized", equation: "x*y" })]
    });

    const controller = new ProjectAutosaveController(
      repository,
      {
        onDirty: vi.fn(),
        onSaving: vi.fn(),
        onSaved: vi.fn(),
        onError: vi.fn()
      },
      400
    );

    controller.scheduleProjectAutosave({
      projectId: saved.id,
      projectName: saved.name,
      scene: changedScene
    });
    vi.advanceTimersByTime(400);

    const updated = repository.getProject(saved.id);
    expect(updated?.sceneJson).toBe(serializeScene(changedScene));
    vi.useRealTimers();
  });
});
