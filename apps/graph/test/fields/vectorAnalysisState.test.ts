import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";

const POINT = { x: 1, y: 2, z: 3 };

function addField2D() {
  const store = useGraphStore.getState();
  return store.addVectorFieldObject("2d");
}

function liveIdentity(id: string): string {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  const identity = vectorCalculusSourceIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (identity === null) {
    throw new Error("expected identity");
  }
  return identity;
}

describe("vector calculus source identity (S22 PART 8)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("covers math identity and ignores sampling/render settings", () => {
    const id = addField2D();
    const base = liveIdentity(id);
    expect(base).toContain("vectorField");
    expect(base).toContain("2d");

    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "density", 24);
    store.updateVectorFieldExpression(id, "scale", 2);
    store.updateVectorFieldExpression(id, "normalize", true);
    store.updateObjectColor(id, "#f59e0b");
    expect(liveIdentity(id)).toBe(base);

    store.updateVectorFieldExpression(id, "pExpr", "-y");
    expect(liveIdentity(id)).not.toBe(base);
  });

  it("tracks dimension, domain, and parameter keys — never values", () => {
    const id = addField2D();
    const base = liveIdentity(id);
    const store = useGraphStore.getState();

    store.setObjectKind(id, "vectorField", "3d");
    expect(liveIdentity(id)).not.toBe(base);

    const afterDimension = liveIdentity(id);
    store.updateVectorFieldExpression(id, "xMax", 6);
    expect(liveIdentity(id)).not.toBe(afterDimension);

    // Parameter VALUES do not invalidate (PART 9: live recompute instead).
    const editor = useEditorStore.getState();
    const previous = editor.parameters;
    try {
      useEditorStore.setState({
        parameters: [...previous, { id: "a", value: 1, min: 0, max: 10 }]
      });
      const withParam = liveIdentity(id);
      expect(withParam).not.toBe(afterDimension);
      useEditorStore.setState({
        parameters: [...previous, { id: "a", value: 7, min: 0, max: 10 }]
      });
      expect(liveIdentity(id)).toBe(withParam);
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });

  it("returns null for non-vector kinds", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    expect(vectorCalculusSourceIdentity(object, [])).toBeNull();
  });
});

describe("vector calculus analysis state (S22 Slice 2)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("sets, toggles, and clears vector records", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
    const record = useGraphStore.getState().ui.vectorCalculusBySourceId[id];
    expect(record).toMatchObject({ sourceId: id, point: POINT });
    expect(record?.showCurl).toBe(false);

    store.setVectorCalculusOverlays(id, { showCurl: true });
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]?.showCurl).toBe(true);

    store.clearVectorCalculus(id);
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeUndefined();
  });

  it("prunes math edits but retains render-only edits", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));

    store.updateVectorFieldExpression(id, "qExpr", "x");
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeUndefined();

    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
    store.updateVectorFieldExpression(id, "yMax", 6);
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeUndefined();

    for (const field of ["density", "scale", "normalize"] as const) {
      store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
      store.updateVectorFieldExpression(
        id,
        field,
        field === "normalize" ? true : field === "density" ? 20 : 2
      );
      expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeDefined();
    }
    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
    store.updateObjectColor(id, "#f59e0b");
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeDefined();
    store.toggleObjectVisibility(id);
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeDefined();
  });

  it("clears on delete, kind switch, dimension switch, and scene replace", () => {
    const store = useGraphStore.getState();
    const id = addField2D();
    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
    store.setObjectKind(id, "surface");
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeUndefined();

    const id2 = addField2D();
    store.setVectorCalculusPoint(id2, POINT, liveIdentity(id2));
    store.setObjectKind(id2, "vectorField", "3d");
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id2]).toBeUndefined();

    const id3 = addField2D();
    store.setVectorCalculusPoint(id3, POINT, liveIdentity(id3));
    store.removeObject(id3);
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id3]).toBeUndefined();

    const id4 = addField2D();
    store.setVectorCalculusPoint(id4, POINT, liveIdentity(id4));
    store.resetScene();
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId).toEqual({});
  });

  it("stores direction inputs independently with their own lifecycle", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toBeUndefined();

    store.setDirectionInput(id, { u: 3, v: 4 });
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toEqual({ u: 3, v: 4 });

    // Non-finite rejected; equation edits retain the input.
    store.setDirectionInput(id, { u: Number.NaN, v: 4 });
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toEqual({ u: 3, v: 4 });
    store.updateSurfaceEquation(id, "z = x^2 + y^2");
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toEqual({ u: 3, v: 4 });

    store.setDirectionInput(id, null);
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toBeUndefined();

    // Delete prunes direction state.
    store.setDirectionInput(id, { u: 1, v: 0 });
    store.removeObject(id);
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toBeUndefined();
  });

  it("never pollutes history, persistence, or the canonical document", () => {
    const store = useGraphStore.getState();
    const id = addField2D();
    const pastBefore = useHistoryStore.getState().past.length;
    store.setVectorCalculusPoint(id, POINT, liveIdentity(id));
    store.setVectorCalculusOverlays(id, { showCurl: true });
    store.setDirectionInput(id, { u: 3, v: 4 });
    store.clearVectorCalculus(id);
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);

    const serialized = JSON.stringify(JSON.parse(serializeScene(useGraphStore.getState().scene)));
    expect(serialized).not.toContain("vectorCalculus");
    expect(serialized).not.toContain("directionInput");
    expect(serialized).not.toContain("showCurl");

    const options = useGraphStore.persist.getOptions();
    const partialized = options.partialize?.(useGraphStore.getState()) as {
      ui: { vectorCalculusBySourceId: unknown; directionInputBySourceId: unknown };
    };
    expect(partialized.ui.vectorCalculusBySourceId).toEqual({});
    expect(partialized.ui.directionInputBySourceId).toEqual({});
  });
});
