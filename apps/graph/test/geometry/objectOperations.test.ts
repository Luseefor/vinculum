import { beforeEach, describe, expect, it } from "vitest";
import type { GraphObject, ImplicitSurfaceObject, ObjectOperation } from "@vinculum/scene/types";
import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { buildObjectOperation } from "@/lib/math/geometry/objectOperations";
import { compileImplicitSurfaceExpression } from "@/lib/math/expressions/compileImplicitSurface";
import { computeImplicitSurfaceData } from "@/lib/math/surfaces/computeImplicitSurfaceData";
import { useGraphStore } from "@/store/graphStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { applySceneCommand } from "@/lib/scene/applyCommand";
import { cloneGraphObject } from "@/lib/scene/sceneSchema";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";

const sphere = (id: string, equation = "x^2+y^2+z^2-4") => createImplicitSurfaceGraph({ id, equation, resolution: 24 });
const object = (id: string) => useGraphStore.getState().scene.objects.find(object => object.id === id)!;
const inside = (object: GraphObject, point: [number, number, number]) => "equation" in object && compileImplicitSurfaceExpression(object.equation, {}).evaluator(...point) <= 0;

beforeEach(() => useGraphStore.getState().resetScene());

describe("geometric region operations", () => {
  it.each(["union", "intersection", "subtract"] as const)("computes the actual %s boundary and region", operation => {
    const built = buildObjectOperation(sphere("a"), sphere("b", "(x-2)^2+y^2+z^2-4"), operation, {});
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.error);
    const evaluate = compileImplicitSurfaceExpression(built.definition.equation, {}).evaluator;
    expect(evaluate(-1, 0, 0) < 0).toBe(operation !== "intersection");
    expect(evaluate(1, 0, 0) < 0).toBe(operation !== "subtract");
    expect(evaluate(3, 0, 0) < 0).toBe(operation === "union");
    expect(evaluate(8, 0, 0)).toBeGreaterThan(0);
    const mesh = computeImplicitSurfaceData({ equation: built.definition.equation, domain: built.definition.domain, resolution: 24, params: {} });
    expect(mesh.status).toBe("ok");
    if (mesh.status === "ok") expect(mesh.indices.length).toBeGreaterThan(0);
  });

  it("preserves subtraction order, clips operands to saved bounds, and produces empty disjoint intersections", () => {
    const a = sphere("a"), b = sphere("b", "(x-2)^2+y^2+z^2-4");
    const ab = buildObjectOperation(a, b, "subtract", {}), ba = buildObjectOperation(b, a, "subtract", {});
    if (!ab.ok || !ba.ok) throw new Error("operation failed");
    expect(compileImplicitSurfaceExpression(ab.definition.equation, {}).evaluator(-1, 0, 0)).toBeLessThan(0);
    expect(compileImplicitSurfaceExpression(ba.definition.equation, {}).evaluator(-1, 0, 0)).toBeGreaterThan(0);
    const clipped = { ...a, domain: { xMin: 0, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 } };
    const limited = buildObjectOperation(clipped, b, "union", {});
    if (!limited.ok) throw new Error(limited.error);
    expect(compileImplicitSurfaceExpression(limited.definition.equation, {}).evaluator(-1, 0, 0)).toBeGreaterThan(0);
    const far = { ...b, domain: { xMin: 10, xMax: 12, yMin: 10, yMax: 12, zMin: 10, zMax: 12 } };
    const empty = buildObjectOperation(a, far, "intersection", {});
    if (!empty.ok) throw new Error(empty.error);
    expect(computeImplicitSurfaceData({ equation: empty.definition.equation, domain: empty.definition.domain, resolution: 16, params: {} }).status).toBe("empty");
  });

  it("combines 2D regions and rejects mixed dimensions and non-region objects", () => {
    const a = { id: "a", kind: "implicitCurve" as const, equation: "x^2+y^2=4", visible: true, color: "#3080ef" };
    const b = { ...a, id: "b", equation: "(x-2)^2+y^2=4" };
    const result = buildObjectOperation(a, b, "intersection", {});
    expect(result).toMatchObject({ ok: true, definition: { kind: "implicitCurve" } });
    if (result.ok) {
      const evaluate = compileImplicitSurfaceExpression(result.definition.equation, {}).evaluator;
      expect(evaluate(1, 0, 0)).toBeLessThan(0);
      expect(evaluate(-1, 0, 0)).toBeGreaterThan(0);
    }
    expect(buildObjectOperation(a, sphere("s"), "union", {})).toMatchObject({ ok: false });
    const pointId = useGraphStore.getState().addPointObject();
    expect(buildObjectOperation(object(pointId), sphere("s"), "union", {})).toMatchObject({ ok: false });
    const cap = buildObjectOperation({ ...a, extendTo3D: true, extensionRange: { zMin: 2, zMax: 6 } }, sphere("s"), "union", {});
    if (!cap.ok) throw new Error(cap.error);
    expect(cap.definition.kind).toBe("implicitSurface");
    expect(compileImplicitSurfaceExpression(cap.definition.equation, {}).evaluator(0, 0, 4)).toBeLessThan(0);
    expect(compileImplicitSurfaceExpression(cap.definition.equation, {}).evaluator(0, 0, 8)).toBeGreaterThan(0);
  });
});

describe("linked operation scene lifecycle", () => {
  function create(operation: ObjectOperation = "union") {
    const graph = useGraphStore.getState();
    graph.addDefinedObject(sphere("a"));
    graph.addDefinedObject(sphere("b", "(x-2)^2+y^2+z^2-4"));
    graph.selectObject("a");
    const added = graph.addObjectOperation(operation, "b");
    expect(added.error).toBeNull();
    return added.id!;
  }

  it("creates one selected result, retains and hides sources, and propagates edits through nested operations", () => {
    const id = create();
    expect(useGraphStore.getState().scene.objects).toHaveLength(3);
    expect(object("a").visible).toBe(false);
    expect(object("b").visible).toBe(false);
    expect(object(id)).toMatchObject({ combination: { operation: "union", operands: ["a", "b"] }, visible: true });
    expect(inside(object(id), [-1, 0, 0])).toBe(true);
    useGraphStore.getState().addDefinedObject(sphere("c", "x^2+y^2+z^2-100"));
    useGraphStore.getState().selectObject(id);
    const nestedId = useGraphStore.getState().addObjectOperation("intersection", "c").id!;
    useGraphStore.getState().updateImplicitSurfaceExpression("a", "equation", "(x-20)^2+y^2+z^2-4");
    expect(inside(object(id), [-1, 0, 0])).toBe(false);
    expect(inside(object(nestedId), [-1, 0, 0])).toBe(false);
    const stable = object(nestedId);
    useGraphStore.getState().updateObjectColor("a", "#ff0000");
    expect(object(nestedId)).toBe(stable);
  });

  it("round-trips references through canonical scene I/O, deep-clones metadata, and regenerates cached definitions", () => {
    const id = create("subtract");
    const serialized = serializeScene(useGraphStore.getState().scene);
    const restored = deserializeScene(serialized);
    expect(restored.valid).toBe(true);
    expect(restored.normalizedScene!.objects.find(object => object.id === id)).toEqual(object(id));
    const cloned = cloneGraphObject(object(id));
    cloned.combination!.operands[0] = "changed";
    expect(object(id).combination!.operands[0]).toBe("a");
    const input = JSON.parse(serialized);
    input.objects.find((object: GraphObject) => object.id === id).equation = "x = 0";
    const repaired = deserializeScene(JSON.stringify(input));
    expect(repaired.valid).toBe(true);
    expect(repaired.normalizedScene!.objects.find(object => object.id === id)).toEqual(object(id));
  });

  it("rejects broken and cyclic references and migrates v2 scenes", () => {
    const id = create();
    const input = JSON.parse(serializeScene(useGraphStore.getState().scene));
    input.objects.find((object: GraphObject) => object.id === id).combination.operands[0] = "missing";
    expect(deserializeScene(JSON.stringify(input)).valid).toBe(false);
    input.objects.find((object: GraphObject) => object.id === id).combination.operands[0] = id;
    expect(deserializeScene(JSON.stringify(input)).valid).toBe(false);
    input.objects = input.objects.filter((object: GraphObject) => object.id !== id);
    input.schemaVersion = 2;
    expect(deserializeScene(JSON.stringify(input)).normalizedScene?.schemaVersion).toBe(4);
  });

  it("rejects imported operations whose sources do not define compatible regions", () => {
    const id = create();
    const input = JSON.parse(serializeScene(useGraphStore.getState().scene));
    input.objects[0] = { id: "a", kind: "implicitCurve", equation: "y=x", color: "#3080ef", visible: true };
    expect(deserializeScene(JSON.stringify(input)).valid).toBe(false);
    input.objects[0] = { id: "a", kind: "point", xExpr: "0", yExpr: "0", zExpr: "0", color: "#3080ef", visible: true };
    expect(deserializeScene(JSON.stringify(input)).valid).toBe(false);
    expect(object(id).combination).toBeDefined();
  });

  it("validates the dependency depth budget without freezing an oversized imported graph", () => {
    const a: GraphObject = { id: "a", kind: "implicitCurve", equation: "y=x", color: "#3080ef", visible: false };
    const objects: GraphObject[] = [a, { ...a, id: "b", equation: "y=-x" }];
    for (let depth = 1; depth <= 12; depth++) objects.push({ ...a, id: `result-${depth}`, combination: { operation: "union", operands: [depth === 1 ? "a" : `result-${depth - 1}`, "b"] } });
    const input = JSON.parse(serializeScene(useGraphStore.getState().scene));
    input.objects = objects;
    expect(deserializeScene(JSON.stringify(input)).valid).toBe(true);
    input.objects.push({ ...a, id: "result-13", combination: { operation: "union", operands: ["result-12", "b"] } });
    const rejected = deserializeScene(JSON.stringify(input));
    expect(rejected.valid).toBe(false);
    expect(rejected.errors.join(" ")).toContain("12 levels");
  });

  it("keeps planar results linked when extruded and used by another 3D operation", () => {
    const store = useGraphStore.getState();
    const a = store.commitAutoEquation("x^2+y^2=4").id!, b = store.commitAutoEquation("(x-2)^2+y^2=4").id!;
    store.selectObject(a);
    const planar = store.addObjectOperation("union", b).id!;
    expect(object(planar).kind).toBe("implicitCurve");
    store.setCurveExtension3D(planar, true);
    store.updateCurveExtensionRange(planar, { zMin: 2, zMax: 8 });
    store.addDefinedObject(sphere("s", "x^2+y^2+z^2-1"));
    store.selectObject(planar);
    const spatial = store.addObjectOperation("union", "s").id!;
    expect(inside(object(spatial), [-1, 0, 6])).toBe(true);
    store.updateCurveExtensionRange(planar, { zMax: 4 });
    expect(inside(object(spatial), [-1, 0, 6])).toBe(false);
    store.commitAutoEquation("(x-10)^2+y^2=4", a);
    expect(inside(object(spatial), [-1, 0, 3])).toBe(false);
    expect(deserializeScene(serializeScene(useGraphStore.getState().scene)).valid).toBe(true);
  });

  it("keeps parameters symbolic and updates results with the shared parameter scope", () => {
    const id = create();
    useGraphStore.getState().updateImplicitSurfaceExpression("a", "equation", "x^2+y^2+z^2-r^2");
    useEditorStore.getState().setParameterDefinition("r", 1);
    const evaluate = () => compileImplicitSurfaceExpression((object(id) as ImplicitSurfaceObject).equation, parametersToScope(useEditorStore.getState().parameters)).evaluator;
    expect(evaluate()(-1.5, 0, 0)).toBeGreaterThan(0);
    useEditorStore.getState().setParameterDefinition("r", 3);
    expect(evaluate()(-1.5, 0, 0)).toBeLessThan(0);
    expect(deserializeScene(serializeScene(useGraphStore.getState().scene)).valid).toBe(true);
  });

  it("hides invalid derived drafts, restores them after correction, and explicitly detaches results", () => {
    const id = create();
    useGraphStore.getState().updateImplicitSurfaceExpression("a", "equation", "sqrt(");
    expect(object(id)).toMatchObject({ equation: "" });
    useGraphStore.getState().updateImplicitSurfaceExpression("a", "equation", "x^2+y^2+z^2-4");
    expect(inside(object(id), [-1, 0, 0])).toBe(true);
    useGraphStore.getState().detachObjectOperation(id);
    const before = object(id);
    useGraphStore.getState().updateImplicitSurfaceExpression("a", "equation", "100");
    expect(object(id)).toBe(before);
    expect(before.combination).toBeUndefined();
  });

  it("removes dependent results with a source and restores the complete graph from an undo snapshot", () => {
    const id = create();
    const before = useGraphStore.getState().scene;
    const removed = applySceneCommand(before, { type: "REMOVE_OBJECT", payload: { id: "a" } });
    expect(removed.objects.some(object => object.id === id)).toBe(false);
    const restored = applySceneCommand(removed, { type: "REPLACE_SCENE", payload: { scene: before } });
    expect(restored.objects).toEqual(before.objects);
  });

  it("prunes dependent selection, focus and analysis records when a source is deleted", () => {
    const id = create();
    const state = useGraphStore.getState();
    state.selectObject(id);
    state.requestEquationFocus(id);
    state.setGeometryAnalysis(id, { secondaryId: "b", showOverlay: true });
    state.setGeometryAnalysis("b", { secondaryId: id, showOverlay: true });
    state.removeObject("a");
    expect(useGraphStore.getState().scene.objects.map(object => object.id)).toEqual(["b"]);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe("b");
    expect(useGraphStore.getState().ui.focusEquationForObjectId).toBeNull();
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId).toEqual({});
  });
});
