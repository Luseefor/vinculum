import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { createSceneDocument, CURRENT_SCENE_SCHEMA_VERSION, sceneHasContent } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { buildShareSceneUrl, readSharedSceneFromSearch } from "@/lib/share/shareSceneLink";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { mergePersistedGraphStore } from "@/store/graphStoreMerge";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";

beforeEach(() => { localStorage.clear(); useGraphStore.getState().resetScene(); });

describe("portable scene parameter values", () => {
  function equation() {
    useGraphStore.getState().commitAutoEquation("y=a*x");
    useEditorStore.getState().setParameterValue("a", 3);
    return useGraphStore.getState().scene;
  }
  it("captures values immediately and omits unrelated editor parameters", () => {
    equation();
    useEditorStore.getState().ensureParameters(["unused"]);
    expect(useGraphStore.getState().scene.parameters).toEqual([{ id: "a", value: 3, min: -10, max: 10 }]);
  });
  it("restores values and bounds after JSON import, independent of recipient scope", () => {
    equation();
    useEditorStore.getState().setParameterDefinition("a", 20);
    const json = serializeScene(useGraphStore.getState().scene);
    useGraphStore.getState().resetScene();
    useEditorStore.getState().setParameterDefinition("a", -2);
    const imported = deserializeScene(json);
    expect(imported.valid).toBe(true);
    expect(getEditorParameterScope().a).toBe(-2);
    useGraphStore.getState().replaceSceneDocument(imported.normalizedScene!);
    expect(useEditorStore.getState().parameters).toEqual([{ id: "a", value: 20, min: -10, max: 20, defined: true }]);
  });
  it("preserves the same scope through share links, projects and recovery", () => {
    const scene = equation();
    const link = buildShareSceneUrl({ scene, baseUrl: "https://example.com/editor" });
    expect(link.ok).toBe(true);
    const repository = new LocalProjectRepository();
    const project = repository.saveProject({ name: "Slope", scene });
    repository.saveUnnamedRecoverySnapshot(scene);
    useGraphStore.getState().resetScene();
    for (const restored of [readSharedSceneFromSearch(new URL(link.url!).search)?.scene, repository.loadProjectScene(project.id), repository.restoreUnnamedRecoverySnapshot()]) {
      useGraphStore.getState().replaceSceneDocument(restored!);
      expect(getEditorParameterScope()).toEqual({ a: 3 });
      expect(useGraphStore.getState().scene.parameters).toEqual(scene.parameters);
    }
  });
  it("keeps standalone definitions and restores values with undo snapshots", () => {
    useGraphStore.getState().commitAutoEquation("a=20");
    expect(sceneHasContent(useGraphStore.getState().scene)).toBe(true);
    const snapshot = getCurrentSceneSnapshot();
    useEditorStore.getState().setParameterValue("a", 5);
    useGraphStore.getState().applySceneSnapshot(snapshot);
    expect(getEditorParameterScope().a).toBe(20);
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });
  it("validates nonautomatic definitions with their saved parameter scope", () => {
    useEditorStore.getState().setParameterDefinition("a", 3);
    const id = useGraphStore.getState().addVectorFieldObject("2d");
    useGraphStore.getState().updateVectorFieldExpression(id, "pExpr", "a*x");
    const json = serializeScene(useGraphStore.getState().scene);
    useGraphStore.getState().resetScene();
    const imported = deserializeScene(json);
    expect(imported.valid).toBe(true);
    useGraphStore.getState().replaceSceneDocument(imported.normalizedScene!);
    expect(getEditorParameterScope()).toEqual({ a: 3 });
  });
  it("validates a parameterized plane without reading the recipient's editor values", () => {
    const scene = createSceneDocument({
      objects: [createPlaneGraph({ equation: "x+y+z=a" })],
      parameters: [{ id: "a", value: 3, min: -10, max: 10 }]
    });
    const imported = deserializeScene(serializeScene(scene));
    expect(imported.valid).toBe(true);
    expect(getEditorParameterScope()).toEqual({});
    useGraphStore.getState().replaceSceneDocument(imported.normalizedScene!);
    expect(getEditorParameterScope().a).toBe(3);
  });
  it("migrates v1 automatic equations and retains old local values during session upgrade", () => {
    const scene = equation();
    const { parameters: _parameters, ...legacy } = scene;
    void _parameters;
    const input = { ...legacy, schemaVersion: 1 };
    const migrated = deserializeScene(JSON.stringify(input));
    expect(migrated.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(migrated.normalizedScene?.parameters[0].value).toBe(1);
    expect(mergePersistedGraphStore({ scene: input }, useGraphStore.getState()).scene.parameters[0].value).toBe(3);
  });
  it("preserves unfinished session drafts while restoring the saved scope", () => {
    const scene = equation();
    const unfinished = { ...scene, objects: scene.objects.map(object => ({ ...object, equation: "y=a*" })) };
    const merged = mergePersistedGraphStore({ scene: unfinished }, useGraphStore.getState());
    expect(merged.scene.objects).toEqual(unfinished.objects);
    expect(merged.scene.parameters).toEqual(scene.parameters);
  });
  it.each([
    [{ id: "a", value: 1, min: 2, max: 3 }],
    [{ id: "a", value: 1, min: 1, max: 1 }],
    [{ id: "a", value: "3", min: -10, max: 10 }],
    [{ id: "constructor", value: 1, min: -10, max: 10 }],
    [{ id: "x", value: 1, min: -10, max: 10 }],
    [{ id: "a".repeat(65), value: 1, min: -10, max: 10 }],
    Array.from({ length: 257 }, (_, index) => ({ id: `p${index}`, value: 1, min: -10, max: 10 })),
    [{ id: "a", value: 1, min: -10, max: 10 }, { id: "a", value: 2, min: -10, max: 10 }]
  ].map(parameters => ({ parameters })))("rejects malformed parameter snapshots without changing the editor", ({ parameters }) => {
    equation();
    const before = getEditorParameterScope();
    const result = deserializeScene(JSON.stringify({ ...createSceneDocument(), parameters }));
    expect(result.valid).toBe(false);
    expect(result.normalizedScene).toBeUndefined();
    expect(getEditorParameterScope()).toEqual(before);
  });
});
