import { beforeEach, describe, expect, it } from "vitest";
import { GRAPH_OBJECT_KINDS, type GraphObject, type GraphObjectKind } from "@vinculum/scene/types";
import { createGraphObject, createEmptyGraphObject, isGraphObjectWithoutExpressions } from "@/store/graphStoreObjectFactory";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { parseObjectKind } from "@/lib/scene/validateScenePrimitives";
import { OBJECT_DESCRIPTORS } from "@/lib/objects/objectDescriptors";
import { createObjectByKey } from "@/lib/objects/objectCreation";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";

// Representative spatial fixtures cross or lie in XY. New kinds must declare
// their intended support and supply a suitable fixture here.
const xySupport = {
  surface: true, implicitCurve: true, parametricCurve: true, plane: true,
  parametricSurface: true, implicitSurface: true, vectorField: false,
  point: true, vector: true, line: true, ray: true, segment: true,
  linearTransform: false
} satisfies Record<GraphObjectKind, boolean>;

function viewFixture(kind: GraphObjectKind): GraphObject {
  const object = createGraphObject(kind, 0, { dimension: "3d" });
  switch (object.kind) {
    case "implicitCurve": return { ...object, equation: "y=x^2" };
    case "point": return { ...object, zExpr: "0" };
    case "vector": return { ...object, ozExpr: "0", vzExpr: "0" };
    case "ray": return { ...object, ozExpr: "0", dzExpr: "0" };
    default: return object;
  }
}

beforeEach(() => {
  useGraphStore.getState().resetScene();
  useGraphStore.getState().setWorkspace("math");
  useEditorStore.getState().setViewportMode("3d");
});

describe.each(GRAPH_OBJECT_KINDS)("%s canonical integration", kind => {
  it("honors the representative XY and spatial rendering contract", () => {
    const object = viewFixture(kind);
    const renderables = buildRenderableGraphsFromScene([object], getAxisPairSpec("xy"), {});
    expect(renderables.length > 0).toBe(xySupport[kind]);
    expect(isGraphObjectRenderable3D(object)).toBe(true);
    expect(buildRenderableGraphsFromScene([{ ...object, visible: false }], getAxisPairSpec("xy"), {})).toEqual([]);
  });

  it.each(["2d", "3d"] as const)("round trips a defined object and creates a blank definition with dimension %s", dimension => {
    const errors: string[] = [];
    expect(parseObjectKind(kind, "kind", errors)).toBe(kind);
    expect(errors).toEqual([]);
    const created = createGraphObject(kind, 0, { dimension });
    // Cartesian curves begin as blank automatic-entry rows.
    const objects = [created.kind === "implicitCurve" ? { ...created, equation: "y=x^2" } : created];
    const blank = createEmptyGraphObject(kind, 1, { dimension });
    expect(blank.kind).toBe(kind);
    expect(isGraphObjectWithoutExpressions(blank)).toBe(true);
    const scene = createSceneDocument({ objects, metadata: { name: "Type integration" } });
    const result = deserializeScene(serializeScene(scene));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.normalizedScene?.objects).toEqual(objects);
  });
});

describe("creation catalog integration", () => {
  it("exposes every kind through the catalog or automatic Cartesian entry", () => {
    expect(new Set([...OBJECT_DESCRIPTORS.map(entry => entry.kind), "implicitCurve"]))
      .toEqual(new Set(GRAPH_OBJECT_KINDS));
  });

  it.each(OBJECT_DESCRIPTORS)("creates $key with its declared kind, dimension, selection and focus", descriptor => {
    const id = createObjectByKey(descriptor.key);
    const state = useGraphStore.getState();
    const object = state.scene.objects.find(entry => entry.id === id);
    expect(id).not.toBe("");
    expect(object?.kind).toBe(descriptor.kind);
    if (descriptor.dimension) expect(object).toHaveProperty("dimension", descriptor.dimension);
    expect(state.ui.selectedObjectId).toBe(id);
    expect(state.ui.focusEquationForObjectId).toBe(id);
    expect(deserializeScene(serializeScene(state.scene)).valid).toBe(true);
  });

  it.each(["missing", "__proto__", "constructor", "toString"])("keeps unknown key %s inert", key => {
    const before = useGraphStore.getState().scene;
    expect(createObjectByKey(key)).toBe("");
    expect(useGraphStore.getState().scene).toBe(before);
  });
});
