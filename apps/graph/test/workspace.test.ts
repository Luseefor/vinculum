import { describe, expect, it, beforeEach } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { mergePersistedGraphStore } from "@/store/graphStoreMerge";
import { createInitialUiState } from "@/store/graphStoreViewportInit";
import { serializeScene } from "@/lib/scene/serializeScene";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";

describe("workspace state", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setWorkspace("math");
  });

  it("defaults to Math Lab", () => {
    expect(createInitialUiState(null).workspace).toBe("math");
    expect(useGraphStore.getState().ui.workspace).toBe("math");
  });

  it("switches workspace without touching scene, selection, or view state", () => {
    const state = useGraphStore.getState();
    const surface = state.addSurfaceObject();
    state.updateSurfaceEquation(surface, "z = x^2 + y^2");
    state.updateObjectColor(surface, "#ff0000");
    const plane = state.addPlaneObject();
    state.updatePlaneEquation(plane, "z = 0");
    state.toggleObjectVisibility(plane);
    const curve = state.addParametricCurve();
    state.selectObject(curve);
    const before = JSON.stringify({
      scene: useGraphStore.getState().scene,
      selection: useGraphStore.getState().ui.selectedObjectId,
      graphMode: useGraphStore.getState().ui.graphMode
    });

    useGraphStore.getState().setWorkspace("geometry");
    expect(useGraphStore.getState().ui.workspace).toBe("geometry");
    useGraphStore.getState().setWorkspace("math");
    expect(useGraphStore.getState().ui.workspace).toBe("math");

    const after = JSON.stringify({
      scene: useGraphStore.getState().scene,
      selection: useGraphStore.getState().ui.selectedObjectId,
      graphMode: useGraphStore.getState().ui.graphMode
    });
    expect(after).toBe(before);
  });

  it("ignores redundant workspace sets without scene churn", () => {
    const state = useGraphStore.getState();
    state.addSurfaceObject();
    const before = JSON.stringify(useGraphStore.getState().scene);
    state.setWorkspace("math");
    state.setWorkspace("math");
    expect(JSON.stringify(useGraphStore.getState().scene)).toBe(before);
  });

  it("merge defaults missing or invalid workspace to math", () => {
    const current = useGraphStore.getState();
    const base = {
      scene: createSceneDocument({ metadata: { name: "t" }, objects: [] }),
      ui: { ...createInitialUiState(null) }
    };
    const missing = mergePersistedGraphStore(
      { scene: base.scene, ui: { ...base.ui, workspace: undefined } },
      { ...current, scene: base.scene, ui: base.ui }
    );
    expect(missing.ui.workspace).toBe("math");
    const invalid = mergePersistedGraphStore(
      { scene: base.scene, ui: { ...base.ui, workspace: "cad" } },
      { ...current, scene: base.scene, ui: base.ui }
    );
    expect(invalid.ui.workspace).toBe("math");
  });

  it("serialized scenes never contain workspace state", () => {
    useGraphStore.getState().setWorkspace("geometry");
    const scene = createSceneDocument({ metadata: { name: "t" }, objects: [] });
    expect(serializeScene(scene)).not.toContain("workspace");
  });
});

describe("workspace content config", () => {
  it("covers the same Quick Add actions in both workspaces with different priority", () => {
    const geometry = [...WORKSPACE_CONTENT.geometry.quickAddOrder].sort();
    const math = [...WORKSPACE_CONTENT.math.quickAddOrder].sort();
    expect(geometry).toEqual(math);
    expect(WORKSPACE_CONTENT.geometry.quickAddOrder).not.toEqual(WORKSPACE_CONTENT.math.quickAddOrder);
    expect(WORKSPACE_CONTENT.geometry.quickAddOrder[0]).toBe("Plane");
    expect(WORKSPACE_CONTENT.math.quickAddOrder[0]).toBe("Surface");
  });

  it("labels workspaces without marketing copy", () => {
    expect(WORKSPACE_CONTENT.geometry.label).toBe("Geometry Studio");
    expect(WORKSPACE_CONTENT.math.label).toBe("Math Lab");
    expect(WORKSPACE_CONTENT.geometry.emptyHint).not.toMatch(/welcome|powerful|ultimate/i);
    expect(WORKSPACE_CONTENT.math.emptyHint).not.toMatch(/welcome|powerful|ultimate/i);
  });
});
