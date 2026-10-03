import { export2dSvg } from "@/lib/export/sceneExport";
import { beforeEach, describe, expect, it } from "vitest";
import { inferGraphEquation } from "@/lib/math/inferGraphEquation";
import { useGraphStore } from "@/store/graphStore";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";

beforeEach(() => useGraphStore.getState().resetScene());

describe("automatic equation classification", () => {
  it.each(["x=y^2", "y=sin(x)", "x^2+y^2=4", "x=2", "y=3", "6*cos(x^2)^2", "f(x)=x^2", "y=x+y"])("plots %s as a planar curve", (equation) => {
    expect(inferGraphEquation(equation)).toMatchObject({ ok: true, dimension: "2d", kind: "implicitCurve" });
  });
  it.each(["x=y^2+z^2", "z=x^2+y^2", "y=x+z", "sin(x)*cos(y)", "f(x,y)=x^2+y^2"])("plots %s as an explicit 3D surface", (equation) => {
    expect(inferGraphEquation(equation)).toMatchObject({ ok: true, dimension: "3d", kind: "surface" });
  });
  it.each(["x^2+y^2+z^2=4", "x+y+z=1", "x*y*z"])("plots %s as an implicit 3D relation", (equation) => {
    expect(inferGraphEquation(equation)).toMatchObject({ ok: true, dimension: "3d", kind: "implicitSurface" });
  });
  it.each(["x=", "x=y=z", "import('evil')", "x=unknown(y)", "x=t^2", "x=1; z=2"])("rejects %s without changing the scene", (equation) => {
    const before = useGraphStore.getState().scene;
    expect(useGraphStore.getState().commitAutoEquation(equation).error).toBeTruthy();
    expect(useGraphStore.getState().scene).toBe(before);
  });
  it("uses parsed symbols rather than a z in a parameter name", () => {
    expect(inferGraphEquation("y=zoom*x", { zoom: 2 })).toMatchObject({ ok: true, dimension: "2d" });
  });
});

describe("automatic scene equations", () => {
  it("renders the sideways parabola as a zero contour and a planar 3D curve", () => {
    const result = useGraphStore.getState().commitAutoEquation("x=y^2");
    expect(result.error).toBeNull();
    const object = useGraphStore.getState().scene.objects[0]!;
    expect(object.kind).toBe("implicitCurve");
    expect(isGraphObjectRenderable3D(object)).toBe(true);
    const graphs = buildRenderableGraphsFromScene([object], { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {});
    expect(graphs).toHaveLength(1);
    expect(graphs[0]!.hatchDomain).toBeNull();
    expect(graphs[0]!.implicitEvaluate?.(4, 2)).toBe(0);
    expect(graphs[0]!.implicitEvaluate?.(3, 2)).toBe(-1);
    expect(buildRenderableGraphsFromScene([object], { horizontal: "x", vertical: "z", horizontalLabel: "X", verticalLabel: "Z" }, {})).toHaveLength(0);
  });
  it("infers bare functions and circles without losing their definitions", () => {
    const first = useGraphStore.getState().commitAutoEquation("cos(x)");
    const circle = useGraphStore.getState().commitAutoEquation("x^2+y^2=4");
    expect(first.error).toBeNull(); expect(circle.error).toBeNull();
    const graphs = buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {});
    expect(graphs[0]!.evaluate?.(0)).toBe(1);
    expect(graphs[1]!.implicitEvaluate?.(0, -2)).toBe(0);
  });
  it("keeps identity, color, visibility, and order through 2D/3D edits and canonical roundtrip", () => {
    const id = useGraphStore.getState().commitAutoEquation("x=y^2").id!;
    useGraphStore.getState().updateObjectColor(id, "#ff0000");
    useGraphStore.getState().toggleObjectVisibility(id);
    useGraphStore.getState().commitAutoEquation("y=x+1");
    const next = useGraphStore.getState().commitAutoEquation("x=y^2+z^2", id);
    expect(next).toMatchObject({ id, dimension: "3d", error: null });
    const surface = useGraphStore.getState().scene.objects[0]!;
    expect(surface).toMatchObject({ kind: "surface", orientation: "x", color: "#ff0000", visible: false, equation: "x=y^2+z^2" });
    if (surface.kind !== "surface") throw new Error("Expected surface");
    expect(compileSurfaceExpression(surface.equation, surface.orientation).evaluator(2, 3)).toBe(13);
    expect(useGraphStore.getState().commitAutoEquation("x^2+y^2+z^2=4", id).error).toBeNull();
    expect(compileImplicitSurfaceExpression("x^2+y^2+z^2=4", {}).evaluator(0, 0, 2)).toBe(0);
    expect(useGraphStore.getState().commitAutoEquation("x=y^2", id).error).toBeNull();
    const serialized = serializeScene(useGraphStore.getState().scene);
    const restored = deserializeScene(serialized);
    expect(restored.valid).toBe(true);
    expect(restored.normalizedScene!.objects[0]).toMatchObject({ id, kind: "implicitCurve", equation: "x=y^2", autoExpression: true, color: "#ff0000", visible: false });
    expect(restored.normalizedScene!.objects[1]).toMatchObject({ equation: "y=x+1" });
  });
  it("invalid edits leave the last valid plot intact and clearing removes geometry", () => {
    const id = useGraphStore.getState().commitAutoEquation("x=y^2").id!;
    const before = useGraphStore.getState().scene;
    expect(useGraphStore.getState().commitAutoEquation("x=y^", id).error).toBeTruthy();
    expect(useGraphStore.getState().scene).toBe(before);
    useGraphStore.getState().commitAutoEquation("", id);
    expect(buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {})).toHaveLength(0);
  });
});

it("exports a sideways parabola using the same contour sampler as the canvas", async () => {
  useGraphStore.getState().commitAutoEquation("x=y^2");
  const result = export2dSvg({ objects: useGraphStore.getState().scene.objects, axisPair: "xy", viewport: { centerX: 0, centerY: 0, scale: 40 }, viewportFrame: { width: 600, height: 400 }, sceneName: "Parabola" });
  expect(result.ok).toBe(true);
  expect(result.file?.warnings).toEqual([]);
  expect(await result.file!.blob.text()).toMatch(/<path d="M [^"]+" fill="none" stroke="#3b82f6"/);
});

it("keeps explicit function discontinuities in the existing function sampler", () => {
  useGraphStore.getState().commitAutoEquation("y=1/x");
  const [graph] = buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {});
  expect(graph.implicitEvaluate).toBeNull();
  expect(graph.evaluate?.(0)).toBeNull();
  expect(graph.evaluate?.(2)).toBe(0.5);
  expect(graph.evaluate?.(-2)).toBe(-0.5);
});
