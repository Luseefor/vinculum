import { beforeEach, describe, expect, it } from "vitest";
import { GRAPH_OBJECT_KINDS } from "@vinculum/scene/types";
import { createEmptyGraphObject, createGraphObject } from "@/store/graphStoreObjectFactory";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { buildShareSceneUrl } from "@/lib/share/shareSceneLink";
import { exportSceneJson } from "@/lib/export/sceneExport";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";
import { useGraphStore } from "@/store/graphStore";

beforeEach(() => { localStorage.clear(); useGraphStore.getState().resetScene(); });

describe.each(GRAPH_OBJECT_KINDS)("%s blank document policy", kind => {
  it.each(["2d", "3d"] as const)("rejects an unfinished %s object without silently dropping it", dimension => {
    const scene = createSceneDocument({ objects: [createGraphObject("surface", 0), createEmptyGraphObject(kind, 1, { dimension })] });
    const before = useGraphStore.getState().scene;
    const result = deserializeScene(serializeScene(scene));
    expect(result.valid).toBe(false);
    expect(result.normalizedScene).toBeUndefined();
    expect(result.errors.join(" ")).toContain("objects[1]");
    expect(useGraphStore.getState().scene).toBe(before);
    expect(buildShareSceneUrl({ scene, baseUrl: "https://example.com/editor" })).toMatchObject({ ok: false });
    expect(exportSceneJson(scene)).toMatchObject({ ok: false });
  });
});

it("preserves healthy projects and recovery snapshots when unfinished saves fail", () => {
  const repository = new LocalProjectRepository();
  const valid = createSceneDocument({ objects: [createGraphObject("surface", 0)] });
  const saved = repository.saveProject({ name: "Keep", scene: valid });
  repository.saveUnnamedRecoverySnapshot(valid);
  const unfinished = createSceneDocument({ objects: [createEmptyGraphObject("parametricCurve", 0)] });
  expect(() => repository.saveProject({ name: "Keep", projectId: saved.id, scene: unfinished })).toThrow(/incomplete definition/);
  expect(() => repository.saveUnnamedRecoverySnapshot(unfinished)).toThrow(/incomplete definition/);
  expect(repository.loadProjectScene(saved.id).objects).toEqual(valid.objects);
  expect(repository.restoreUnnamedRecoverySnapshot()?.objects).toEqual(valid.objects);
});

it("retains blank live authoring rows through session hydration until completed", async () => {
  const result = useGraphStore.getState().commitAutoEquation("");
  expect(result.error).toBeNull();
  expect(useGraphStore.getState().scene.objects).toHaveLength(1);
  expect(JSON.parse(sessionStorage.getItem("vinculum-graph-session")!).state.scene.objects).toHaveLength(1);
  const savedDraft = sessionStorage.getItem("vinculum-graph-session")!;
  useGraphStore.getState().resetScene();
  sessionStorage.setItem("vinculum-graph-session", savedDraft);
  await useGraphStore.persist.rehydrate();
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ id: result.id, equation: "" }]);
  expect(buildShareSceneUrl({ scene: useGraphStore.getState().scene, baseUrl: "https://example.com/editor" }).ok).toBe(false);
  expect(useGraphStore.getState().commitAutoEquation("y=x^2", result.id!).error).toBeNull();
  expect(deserializeScene(serializeScene(useGraphStore.getState().scene)).valid).toBe(true);
});
