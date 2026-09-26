import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { cloneGraphObject } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";
import { export2dSvg } from "@/lib/export/sceneExport";
import { buildIntegralJob } from "@/lib/compute/integralSync";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

beforeEach(() => {
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
});

describe("linearTransform scene lifecycle (S28 PART 38/39/68/69)", () => {
  it("creates identity 2D/3D transforms selected with focus", () => {
    const store = useGraphStore.getState();
    const id2 = store.addLinearTransformObject("2d");
    const object2 = useGraphStore.getState().scene.objects.find((o) => o.id === id2);
    expect(object2).toMatchObject({ kind: "linearTransform", dimension: "2d", m11: "1", m22: "1" });
    const id3 = store.addLinearTransformObject("3d");
    const object3 = useGraphStore.getState().scene.objects.find((o) => o.id === id3);
    expect(object3).toMatchObject({ kind: "linearTransform", dimension: "3d", m33: "1" });
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id3);
  });

  it("edits entries and converts dimensions preserving entries", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    store.updateLinearTransformEntry(id, "m11", "a");
    store.updateLinearTransformEntry(id, "m12", "2");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      m11: "a",
      m12: "2"
    });
    // Off-dimension writes reject without mutation.
    const before = JSON.stringify(useGraphStore.getState().scene.objects.find((o) => o.id === id));
    store.updateLinearTransformEntry(id, "m33", "1");
    expect(JSON.stringify(useGraphStore.getState().scene.objects.find((o) => o.id === id))).toBe(before);
    // 2D→3D embeds on XY with z fixed; 3D→2D keeps top-left.
    store.setObjectKind(id, "linearTransform", "3d");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      kind: "linearTransform",
      dimension: "3d",
      m11: "a",
      m12: "2",
      m13: "0",
      m33: "1"
    });
    store.setObjectKind(id, "linearTransform", "2d");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      dimension: "2d",
      m11: "a",
      m22: "1"
    });
  });

  it("supports undo/redo and delete through canonical history", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    const state = useGraphStore.getState();
    useHistoryStore.getState().pushSnapshot({
      objects: state.scene.objects,
      measurements: state.scene.measurements,
      selection: { selectedObjectId: state.ui.selectedObjectId }
    });
    store.updateLinearTransformEntry(id, "m11", "5");
    const snapshot = useHistoryStore.getState().past[useHistoryStore.getState().past.length - 1];
    useGraphStore.getState().applySceneSnapshot(snapshot!);
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({ m11: "1" });
    store.removeObject(id);
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });

  it("roundtrips serialize/deserialize/share/clone byte-exact", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    store.updateLinearTransformEntry(id, "m11", "2*pi");
    const scene = useGraphStore.getState().scene;
    const restored = deserializeScene(serializeScene(scene));
    expect(restored.valid).toBe(true);
    const point = restored.normalizedScene?.objects.find((o) => o.id === id);
    expect(point?.kind === "linearTransform" && point.m11).toBe("2*pi");
    const cloned = cloneGraphObject(scene.objects.find((o) => o.id === id)!);
    expect(cloned).toEqual(scene.objects.find((o) => o.id === id));
    const built = buildShareSceneUrl({ scene, baseUrl: "http://localhost/editor" });
    expect(built.ok).toBe(true);
    if (built.ok && built.url) {
      const payload = new URL(built.url).searchParams.get("scene") ?? "";
      const decoded = decodeSharedScenePayload(payload);
      expect(decoded.scene?.objects.find((o) => o.id === id)?.kind).toBe("linearTransform");
    }
  });

  it("rejects bad payloads and warns explicitly in SVG", () => {
    const envelope = {
      version: "1.0",
      metadata: { name: "s28", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
    const missing = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [{ id: "t1", kind: "linearTransform", dimension: "2d", color: "#3b82f6", visible: true, m11: "1", m12: "0", m21: "0" }]
      })
    );
    expect(missing.valid).toBe(false);
    const spatial = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [{ id: "t1", kind: "linearTransform", dimension: "2d", color: "#3b82f6", visible: true, m11: "x", m12: "0", m21: "0", m22: "1" }]
      })
    );
    expect(spatial.valid).toBe(false);
    const badDimension = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [{ id: "t1", kind: "linearTransform", dimension: "4d", color: "#3b82f6", visible: true, m11: "1", m12: "0", m21: "0", m22: "1" }]
      })
    );
    expect(badDimension.valid).toBe(false);
    const store = useGraphStore.getState();
    store.addLinearTransformObject("2d");
    const result = export2dSvg({
      sceneName: "s28",
      objects: useGraphStore.getState().scene.objects,
      axisPair: "xy",
      viewport: { centerX: 0, centerY: 0, scale: 60 },
      viewportFrame: { width: 800, height: 600 }
    });
    expect(result.ok).toBe(true);
    expect(result.file?.warnings?.length).toBeGreaterThanOrEqual(1);
  });

  it("never appears as an Integral Analysis target (S28 S25-regression)", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("3d");
    const params = getEditorParameterScope();
    store.setIntegralConfig(id, { mode: "arcLength" });
    const config = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
    expect(buildIntegralJob(useGraphStore.getState().scene.objects, config, params)).toBeNull();
  });

  it("keeps analysis transient across replace and history", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    const vectorId = store.addVectorObject();
    store.setLinearTransformAnalysis(id, { vectorId, showVector: true, showEigen: true });
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId[id]).toBeDefined();
    const depth = useHistoryStore.getState().past.length;
    store.setLinearTransformAnalysis(id, { showVector: false });
    expect(useHistoryStore.getState().past.length).toBe(depth);
    expect(JSON.stringify(useGraphStore.getState().scene)).not.toContain("inearTransformAnalysis");
    store.removeObject(vectorId);
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId[id]).toBeUndefined();
    const a = store.addLinearTransformObject("2d");
    store.setLinearTransformAnalysis(a, { showEigen: true });
    store.resetScene();
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId).toEqual({});
  });
});
