import { beforeEach, describe, expect, it } from "vitest";
import { plotFieldProblem } from "@/lib/objects/plotFieldProblem";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";

beforeEach(() => { useGraphStore.getState().resetScene(); useEditorStore.setState({ parameters: [] }); });
describe("solver plot integration", () => {
  it("adds polar vector fields using a correct Cartesian basis and preserves the origin hole", () => {
    const result = plotFieldProblem({ kind: "vector", coordinates: "polar", dimension: "2", components: ["0", "r"], params: {} });
    expect(result.error).toBeNull();
    const field = useGraphStore.getState().scene.objects[0]!;
    if (field.kind !== "vectorField") throw new Error("Expected field");
    const compiled = compileVectorFieldExpressions(field.dimension, field.pExpr, field.qExpr, field.rExpr, {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate2D?.(3, 4)).toEqual([-4, 3]);
    expect(compiled.evaluate2D?.(0, 0)?.every(Number.isNaN)).toBe(true);
    const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
    expect(restored.valid).toBe(true);
    expect(restored.errors).toEqual([]);
    expect(restored.normalizedScene?.objects[0]).toEqual(field);
  });
  it("creates a polar curve and a polar scalar surface using canonical parametric objects", () => {
    expect(plotFieldProblem({ kind: "curve", coordinates: "polar", dimension: "2", components: ["2*cos(3*theta)"], params: {} }).error).toBeNull();
    expect(plotFieldProblem({ kind: "scalar", coordinates: "polar", dimension: "2", components: ["r^2"], params: {} }).error).toBeNull();
    expect(useGraphStore.getState().scene.objects.map((object) => object.kind)).toEqual(["parametricCurve", "parametricSurface"]);
    expect(deserializeScene(serializeScene(useGraphStore.getState().scene)).valid).toBe(true);
  });
  it("does not mutate the scene on invalid definitions", () => {
    const before = useGraphStore.getState().scene;
    expect(plotFieldProblem({ kind: "vector", coordinates: "cartesian", dimension: "2", components: ["factorial(x)", "y"], params: {} }).error).not.toBeNull();
    expect(useGraphStore.getState().scene).toBe(before);
  });
});
