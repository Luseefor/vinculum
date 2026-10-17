import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { cloneGraphObject } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";

beforeEach(() => {
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
});

describe("canonical point scene lifecycle (S27 PART 1/30)", () => {
  it("creates real point objects with asymmetric defaults", () => {
    const id = useGraphStore.getState().addPointObject();
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(object?.kind).toBe("point");
    if (object?.kind !== "point") {
      return;
    }
    expect([object.xExpr, object.yExpr, object.zExpr]).toEqual(["1", "2", "3"]);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
  });

  it("edits coordinates and supports undo/redo + delete", () => {
    const store = useGraphStore.getState();
    const id = store.addPointObject();
    store.updateGeometryCoordinate(id, "xExpr", "a+1");
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      kind: "point",
      xExpr: "a+1"
    });
    const state = useGraphStore.getState();
    useHistoryStore.getState().pushSnapshot({
      objects: state.scene.objects,
      measurements: state.scene.measurements,
      selection: { selectedObjectId: state.ui.selectedObjectId }
    });
    store.updateGeometryCoordinate(id, "xExpr", "9");
    const snapshot = useHistoryStore.getState().past[useHistoryStore.getState().past.length - 1];
    useGraphStore.getState().applySceneSnapshot(snapshot!);
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      xExpr: "a+1"
    });
    store.removeObject(id);
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });

  it("roundtrips serialize/deserialize/share/clone byte-exact", () => {
    const store = useGraphStore.getState();
    const id = store.addPointObject();
    store.updateGeometryCoordinate(id, "zExpr", "2*pi");
    const scene = useGraphStore.getState().scene;
    const restored = deserializeScene(serializeScene(scene));
    expect(restored.valid).toBe(true);
    const point = restored.normalizedScene?.objects.find((o) => o.id === id);
    expect(point?.kind === "point" && point.zExpr).toBe("2*pi");
    const cloned = cloneGraphObject(scene.objects.find((o) => o.id === id)!);
    expect(cloned).toEqual(scene.objects.find((o) => o.id === id));
    const built = buildShareSceneUrl({ scene, baseUrl: "http://localhost/editor" });
    expect(built.ok).toBe(true);
    if (built.ok && built.url) {
      const payload = new URL(built.url).searchParams.get("scene") ?? "";
      const decoded = decodeSharedScenePayload(payload);
      expect(decoded.scene?.objects.find((o) => o.id === id)?.kind).toBe("point");
    }
  });

  it("rejects bad point payloads at import", () => {
    const envelope = {
      version: "1.0",
      metadata: { name: "s27", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
    const missing = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [{ id: "p1", kind: "point", color: "#3b82f6", visible: true, xExpr: "1", yExpr: "2" }]
      })
    );
    expect(missing.valid).toBe(false);
    const spatial = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [{ id: "p1", kind: "point", color: "#3b82f6", visible: true, xExpr: "x", yExpr: "0", zExpr: "0" }]
      })
    );
    expect(spatial.valid).toBe(false);
  });
});

describe("legacy point-preset compatibility (S27 PART 31)", () => {
  it("loads constant parametric curves unchanged as parametricCurve", () => {
    const envelope = {
      version: "1.0",
      metadata: { name: "legacy", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
    const legacy = deserializeScene(
      JSON.stringify({
        ...envelope,
        schemaVersion: 1,
        objects: [
          {
            id: "c1",
            kind: "parametricCurve",
            color: "#3b82f6",
            visible: true,
            xExpr: "0",
            yExpr: "0",
            zExpr: "0",
            tMin: 0,
            tMax: 1,
            samples: 2
          }
        ]
      })
    );
    expect(legacy.valid).toBe(true);
    expect(legacy.normalizedScene?.objects[0]?.kind).toBe("parametricCurve");
  });
});
