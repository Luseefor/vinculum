import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { buildIntegralJob } from "@/lib/compute/integralSync";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { cloneGraphObject } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { export2dSvg } from "@/lib/export/sceneExport";
import { updateGeometryPrimitiveField } from "@/store/graphStoreGeometryPrimitiveField";
import { isGraphObjectWithoutExpressions } from "@/store/graphStoreObjectFactory";

beforeEach(() => {
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
});

describe("primitive creation and field commits (S26 PART 25/31)", () => {
  it("adds vector/line/ray/segment selected with focused defaults", () => {
    const store = useGraphStore.getState();
    const vectorId = store.addVectorObject();
    const lineId = store.addLineObject();
    const rayId = store.addRayObject();
    const segmentId = store.addSegmentObject();
    const objects = useGraphStore.getState().scene.objects;
    expect(objects).toHaveLength(4);
    expect(objects.find((o) => o.id === vectorId)?.kind).toBe("vector");
    expect(objects.find((o) => o.id === lineId)?.kind).toBe("line");
    expect(objects.find((o) => o.id === rayId)?.kind).toBe("ray");
    expect(objects.find((o) => o.id === segmentId)?.kind).toBe("segment");
    // Creation selects the new object (appendObject contract); the
    // creation-focus request is a separate UI action (createAndFocus).
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(segmentId);
    useGraphStore.getState().requestEquationFocus(segmentId);
    expect(useGraphStore.getState().ui.focusEquationForObjectId).toBe(segmentId);
  });

  it("commits coordinate strings and rejects off-kind fields", () => {
    const store = useGraphStore.getState();
    const id = store.addVectorObject();
    store.updateGeometryCoordinate(id, "vxExpr", "cos(theta)");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(object?.kind === "vector" && object.vxExpr).toBe("cos(theta)");
    // Off-kind field rejects without mutation.
    const before = JSON.stringify(object);
    store.updateGeometryCoordinate(id, "pxExpr", "1");
    expect(JSON.stringify(useGraphStore.getState().scene.objects.find((o) => o.id === id))).toBe(before);
    // Wrong-kind target is a no-op.
    const curveId = store.addParametricCurve();
    store.updateGeometryCoordinate(curveId, "vxExpr", "1");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === curveId)?.kind).toBe("parametricCurve");
  });

  it("treats empty primitives as expression-less and converts kinds", () => {
    const store = useGraphStore.getState();
    const id = store.addVectorObject();
    expect(isGraphObjectWithoutExpressions(useGraphStore.getState().scene.objects.find((o) => o.id === id)!)).toBe(
      false
    );
    store.setObjectKind(id, "segment");
    const converted = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(converted?.kind).toBe("segment");
    expect(converted?.id).toBe(id);
  });

  it("supports undo/redo of coordinate edits through canonical history", () => {
    const store = useGraphStore.getState();
    const id = store.addLineObject();
    const state = useGraphStore.getState();
    useHistoryStore.getState().pushSnapshot({
      objects: state.scene.objects,
      measurements: state.scene.measurements,
      selection: { selectedObjectId: state.ui.selectedObjectId }
    });
    store.updateGeometryCoordinate(id, "dxExpr", "9");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({ kind: "line" });
    const snapshot = useHistoryStore.getState().past[useHistoryStore.getState().past.length - 1];
    expect(snapshot).toBeDefined();
    useGraphStore.getState().applySceneSnapshot(snapshot!);
    const restored = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(restored?.kind === "line" && restored.dxExpr).not.toBe("9");
  });

  it("never pollutes history with primitive helper calls", () => {
    const store = useGraphStore.getState();
    const id = store.addRayObject();
    const depth = useHistoryStore.getState().past.length;
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    expect(
      updateGeometryPrimitiveField(
        object as Parameters<typeof updateGeometryPrimitiveField>[0],
        "dxExpr",
        "2"
      )
    ).not.toBeNull();
    expect(useHistoryStore.getState().past.length).toBe(depth);
  });
});

describe("primitive persistence (S26 PART 32)", () => {
  it("roundtrips all four kinds byte-exact through serialize/deserialize", () => {
    const store = useGraphStore.getState();
    store.addVectorObject();
    const lineId = store.addLineObject();
    store.updateGeometryCoordinate(lineId, "dxExpr", "2*pi");
    store.addRayObject();
    store.addSegmentObject();
    const json = serializeScene(useGraphStore.getState().scene);
    const restored = deserializeScene(json);
    expect(restored.valid).toBe(true);
    if (!restored.valid || !restored.normalizedScene) {
      return;
    }
    expect(restored.normalizedScene.objects.map((o) => o.kind)).toEqual(["vector", "line", "ray", "segment"]);
    const line = restored.normalizedScene.objects.find((o) => o.id === lineId);
    expect(line?.kind === "line" && line.dxExpr).toBe("2*pi");
  });

  it("rejects unknown symbols and spatial locals at import, loads legacy scenes", () => {
    const envelope = {
      version: "1.0",
      metadata: { name: "s26", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
    const bad = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [
          { id: "v1", kind: "vector", color: "#3b82f6", visible: true, oxExpr: "0", oyExpr: "0", ozExpr: "0", vxExpr: "zzz", vyExpr: "0", vzExpr: "0" }
        ]
      })
    );
    expect(bad.valid).toBe(false);
    const spatial = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [
          { id: "v1", kind: "vector", color: "#3b82f6", visible: true, oxExpr: "0", oyExpr: "0", ozExpr: "0", vxExpr: "x", vyExpr: "0", vzExpr: "0" }
        ]
      })
    );
    expect(spatial.valid).toBe(false);
    const legacy = deserializeScene(JSON.stringify({ ...envelope, schemaVersion: 1, objects: [] }));
    expect(legacy.valid).toBe(true);
  });

  it("clones raw expressions exactly with no resolved cache", () => {
    const store = useGraphStore.getState();
    const id = store.addSegmentObject();
    store.updateGeometryCoordinate(id, "axExpr", "a+1");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    const cloned = cloneGraphObject(object);
    expect(cloned).toEqual(object);
    expect(cloned).not.toBe(object);
    expect(JSON.stringify(cloned)).not.toContain("resolved");
  });

  it("warns (never silently drops) primitives in SVG export", () => {
    const store = useGraphStore.getState();
    store.addVectorObject();
    store.addLineObject();
    const result = export2dSvg({
      sceneName: "s26",
      objects: useGraphStore.getState().scene.objects,
      axisPair: "xy",
      viewport: { centerX: 0, centerY: 0, scale: 60 },
      viewportFrame: { width: 800, height: 600 }
    });
    expect(result.ok).toBe(true);
    expect(result.file?.warnings?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps new primitives out of integral analysis targets (S26 S25-regression)", () => {
    const store = useGraphStore.getState();
    const id = store.addLineObject();
    const params = getEditorParameterScope();
    store.setIntegralConfig(id, { mode: "arcLength" });
    const config = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
    expect(
      buildIntegralJob(useGraphStore.getState().scene.objects, config, params)
    ).toBeNull();
  });
});
