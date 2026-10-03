import { beforeEach, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import { drawImplicitContour } from "@/components/graph/graph2d/graph2dCanvasImplicitDraw";
import { normalizeMathInput } from "@/lib/math/mathNotation";

const equation = "cos(xy+cos(4y))^2+sin(y)=0.4x+0.1y^2";
beforeEach(() => useGraphStore.getState().resetScene());
it("keeps exact grid-edge roots and omits nonfinite contour cells", () => {
  const viewport = { width: 120, height: 120, centerX: 0, centerY: 0, scale: 30 };
  const segments: number[][] = [];
  let start = [0, 0];
  const context = { moveTo: (x: number, y: number) => { start = [x, y]; }, lineTo: (x: number, y: number) => { segments.push([...start, x, y]); } };
  drawImplicitContour((x) => x, context, viewport, 120, 120);
  expect(segments.length).toBeGreaterThan(0);
  expect(segments.every(([x0, , x1]) => x0 === 60 && x1 === 60)).toBe(true);
  segments.length = 0;
  drawImplicitContour(() => Number.NaN, context, viewport, 120, 120);
  expect(segments).toEqual([]);
  drawImplicitContour(() => 1, context, viewport, 120, 120);
  expect(segments).toEqual([]);
});
it("plots the reported equation in 2D when entered directly or in a legacy surface", () => {
  expect(normalizeMathInput(equation)).toContain("x*y");
  const result = useGraphStore.getState().commitAutoEquation(equation);
  expect(result).toMatchObject({ error: null, dimension: "2d" });
  expect(useGraphStore.getState().scene.objects[0].kind).toBe("implicitCurve");
  const id = useGraphStore.getState().addSurfaceObject();
  useGraphStore.getState().updateSurfaceEquation(id, equation.replace("xy", "x*y"));
  const converted = useGraphStore.getState().scene.objects.find(object => object.id === id)!;
  expect(converted.kind).toBe("implicitCurve");
  expect(isGraphObjectRenderable3D(converted)).toBe(true);
  expect(useEditorStore.getState().viewportMode).toBe("2d");
});
it("does not join opposite hyperbola branches through a saddle cell", () => {
  const segments: number[][] = [];
  let start = [0, 0];
  drawImplicitContour((x, y) => x*y + 0.0001, {
    moveTo: (x, y) => { start = [x, y]; },
    lineTo: (x, y) => { segments.push([...start, x, y]); }
  }, { width: 123, height: 123, centerX: 0, centerY: 0, scale: 100 }, 123, 123);
  const central = segments.filter(segment => segment.every(value => Math.abs(value - 61.5) < 3));
  expect(central.length).toBeGreaterThan(0);
  for (const [x1, y1, x2, y2] of central) {
    expect((x1-61.5)*(x2-61.5)).toBeGreaterThan(0);
    expect((y1-61.5)*(y2-61.5)).toBeGreaterThan(0);
  }
});

it("matches batched Rust samples to the scalar evaluator across tile boundaries", async () => {
  const { compileImplicitSurfaceExpression } = await import("@/lib/math/compileImplicitSurface");
  const compiled = compileImplicitSurfaceExpression("cos(x*y+cos(4*y))^2+sin(y)=0.4*x+0.1*y^2", {});
  const grid = compiled.sampleXYGrid!(-3, 4, 67, 5, -6, 45);
  for (const row of [0, 31, 32, 44]) for (const column of [0, 31, 32, 66]) {
    expect(grid[row*67+column]).toBeCloseTo(compiled.evaluator(-3+7*column/66, 5-11*row/44, 0), 12);
  }
});

it("reuses contour paths for hover redraws and recomputes after zooming", () => {
  let samples = 0;
  const field = (x: number, y: number) => { samples++; return x*x+y*y-1; };
  const context = { moveTo: () => {}, lineTo: () => {} };
  const viewport = { width: 123, height: 123, centerX: 0, centerY: 0, scale: 100 };
  drawImplicitContour(field, context, viewport, 123, 123);
  const first = samples;
  drawImplicitContour(field, context, viewport, 123, 123);
  expect(samples).toBe(first);
  drawImplicitContour(field, context, { ...viewport, scale: 50 }, 123, 123);
  expect(samples).toBeGreaterThan(first);
});


it("preserves the 2D equation and extension flag across edits and canonical serialization", async () => {
  const { serializeScene } = await import("@/lib/scene/serializeScene");
  const { deserializeScene } = await import("@/lib/scene/deserializeScene");
  const { getGraphObjectFor3D } = await import("@/lib/graph3d/graphObject3dGuards");
  const id = useGraphStore.getState().commitAutoEquation("x=y^2").id!;
  useGraphStore.getState().setCurveExtension3D(id, true);
  expect(isGraphObjectRenderable3D(useGraphStore.getState().scene.objects[0])).toBe(true);
  useGraphStore.getState().commitAutoEquation("x=2*y^2", id);
  const scene = useGraphStore.getState().scene;
  expect(scene.objects[0]).toMatchObject({ kind: "implicitCurve", equation: "x=2*y^2", extendTo3D: true });
  expect(getGraphObjectFor3D(scene.objects[0])).toMatchObject({ kind: "implicitSurface", equation: "x=2*y^2" });
  const restored = deserializeScene(serializeScene(scene));
  expect(restored.valid).toBe(true);
  if (restored.valid) expect(restored.normalizedScene!.objects[0]).toMatchObject({ kind: "implicitCurve", extendTo3D: true });
  const invalid = JSON.parse(serializeScene(scene));
  invalid.objects[0].extendTo3D = "yes";
  expect(deserializeScene(JSON.stringify(invalid)).valid).toBe(false);
  useGraphStore.getState().setCurveExtension3D(id, false);
  expect(isGraphObjectRenderable3D(useGraphStore.getState().scene.objects[0])).toBe(true);
});


it("keeps contour evaluator identity across appearance changes so cached paths remain usable", async () => {
  const { buildRenderableGraphsFromScene } = await import("@/components/graph/graph2d/buildRenderableGraphsFromScene");
  const id = useGraphStore.getState().commitAutoEquation("x^2+y^2=4").id!;
  const objects = useGraphStore.getState().scene.objects;
  const axis = { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" } as const;
  const before = buildRenderableGraphsFromScene(objects,axis,{});
  const after = buildRenderableGraphsFromScene(objects.map(o=>({...o,color:"#ef4444"})),axis,{});
  expect(after[0].implicitEvaluate).toBe(before[0].implicitEvaluate);
  const changed = buildRenderableGraphsFromScene(objects.map(o=>o.kind === "implicitCurve"?{...o,equation:"x^2+y^2=9"}:o),axis,{});
  expect(changed[0].implicitEvaluate).not.toBe(before[0].implicitEvaluate);
  expect(id).toBeTruthy();
});
