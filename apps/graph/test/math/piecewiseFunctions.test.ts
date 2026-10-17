import { beforeEach, describe, expect, it } from "vitest";
import { normalizeMathInput, expressionToLatex } from "@/lib/math/expressions/mathNotation";
import { latexToExpression } from "@/lib/math/expressions/mathInputConversion";
import { compileRustExpression } from "@/lib/math/runtime/rustMath";
import { compileSurfaceExpression } from "@/lib/math/expressions/compileExpression";
import { compileParametricExpressions } from "@/lib/math/expressions/compileParametric";
import { sampleCurve } from "@/lib/math/curves/sampleCurve";
import { sampleSurface } from "@/lib/math/surfaces/sampleSurface";
import { inferGraphEquation } from "@/lib/math/expressions/inferGraphEquation";
import { useGraphStore } from "@/store/graphStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { export2dSvg } from "@/lib/export/sceneExport";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";

beforeEach(() => useGraphStore.getState().resetScene());

describe("piecewise entry", () => {
  it.each(["{0 for t<0; 1 for t>=0}", "{t<0:0, t>=0:1}", "{0 if t<0; 1 otherwise}"])("evaluates %s with exact boundary ownership", source => {
    const compiled = compileRustExpression(normalizeMathInput(source));
    expect(compiled.evaluate({ t: -0.1 })).toBe(0);
    expect(compiled.evaluate({ t: 0 })).toBe(1);
    expect(compiled.evaluate({ t: 0.1 })).toBe(1);
  });
  it("leaves uncovered intervals undefined and evaluates only the selected branch", () => {
    const compiled = compileRustExpression(normalizeMathInput("{sqrt(t) for t>=0}"));
    expect(compiled.evaluate({ t: -1 })).toBeNaN();
    expect(compiled.evaluate({ t: 4 })).toBe(2);
    expect(compileRustExpression(normalizeMathInput("{0 for t<=0; 1/t otherwise}")).evaluate({ t: 0 })).toBe(0);
  });
  it("uses first-match conditions and chained intervals", () => {
    const compiled = compileRustExpression(normalizeMathInput("{2 for -1<=t<1; 4 for t<2; 8 otherwise}"));
    expect(compiled.evaluate({ t: 0 })).toBe(2);
    expect(compiled.evaluate({ t: 1 })).toBe(4);
    expect(compiled.evaluate({ t: 3 })).toBe(8);
  });
  it.each(["f(t)={0 for t<0; 1 for t>=0}", "f(x)={x^2 for x<0; x otherwise}", "y={x<=0:0, x>0:1}", "{x<=0:0, x>0:1}"])("classifies %s as a planar function", source => {
    expect(inferGraphEquation(source)).toMatchObject({ ok: true, kind: "implicitCurve", dimension: "2d", explicitAxis: "y" });
  });
  it.each(["f(t)={0;1}", "f(t)={0 for t<0", "f(t)={0 otherwise;1 for t>0}", "f(t)={import(1) for t<0;1 otherwise}"])("rejects %s and preserves the previous graph", source => {
    useGraphStore.getState().commitAutoEquation("y=x");
    const before = useGraphStore.getState().scene;
    expect(useGraphStore.getState().commitAutoEquation(source).error).toBeTruthy();
    expect(useGraphStore.getState().scene).toBe(before);
  });
  it("roundtrips saved named-time functions and renders their graph", () => {
    expect(useGraphStore.getState().commitAutoEquation("f(t)={0 for t<0;1 for t>=0}").error).toBeNull();
    const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
    expect(restored.valid).toBe(true);
    const [graph] = buildRenderableGraphsFromScene(restored.normalizedScene!.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {});
    expect(graph.evaluate?.(-1)).toBeCloseTo(0);
    expect(graph.evaluate?.(0)).toBe(1);
  });
  it.each(["{0 for t<0;1 for t>=0}", "{sqrt(x) for x>=0}", "{x for x<0; x^2 otherwise}"])("roundtrips cases through the typeset editor: %s", source => {
    const latex = expressionToLatex(source)!;
    expect(latex).toContain("\\begin{cases}");
    const decoded = latexToExpression(latex);
    expect(decoded, latex).not.toBeNull();
    const before = compileRustExpression(normalizeMathInput(source));
    const after = compileRustExpression(decoded!);
    for (const value of [-1, 0, 1]) {
      const a = before.evaluate({ x: value, t: value }), b = after.evaluate({ x: value, t: value });
      if (Number.isNaN(a)) expect(b).toBeNaN(); else expect(b).toBeCloseTo(a);
    }
  });
  it.each(["f(t)={0 for t<0;1 for t>=0}", "f(x,y)={0 for x+y<0;1 otherwise}"])("retains function labels through cases editing: %s", source => {
    const latex = expressionToLatex(source)!;
    const decoded = latexToExpression(latex);
    expect(decoded, latex).not.toBeNull();
    expect(inferGraphEquation(decoded!)).toMatchObject({ ok: true });
  });
});

describe("discontinuity topology", () => {
  it.each(["t<0.13 ? 0 : 1", "floor(t)", "1/(t-0.13)"])("cuts jumps and poles in 3D and projected parametric curves: %s", expression => {
    const compiled = compileParametricExpressions("t", expression, "0");
    expect(compiled.error).toBeNull();
    const sampled = sampleCurve(compiled.evaluator, { tMin: -1, tMax: 1, samples: 40 });
    expect([...sampled.connectedSegments]).toContain(0);
  });
  it.each(["t<0 ? t : t", "t<0 ? -t : t", "100000*t", "1/(t+3)"])("preserves continuous curves: %s", expression => {
    const sampled = sampleCurve(compileParametricExpressions("t", expression, "0").evaluator, { tMin: -1, tMax: 1, samples: 40 });
    expect([...sampled.connectedSegments]).not.toContain(0);
  });
  it.each(["x<0.13 ? 0 : 1", "x+y<0.13 ? 0 : 1"])("never adds triangles between step levels: %s", equation => {
    const sampled = sampleSurface(compileSurfaceExpression(equation).evaluator, { domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, resolution: 20 });
    expect(sampled.indices.length).toBeGreaterThan(0);
    expect(sampled.rejectedTriangles).toBeGreaterThan(0);
    for (let i = 0; i < sampled.indices.length; i += 3) {
      const heights = [...sampled.indices.slice(i, i + 3)].map(index => sampled.positions[index * 3 + 1]);
      expect(new Set(heights).size).toBe(1);
    }
  });
  it("keeps continuous branch boundaries triangulated", () => {
    const sampled = sampleSurface(compileSurfaceExpression("x<0 ? -x : x").evaluator, { domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, resolution: 20 });
    expect(sampled.rejectedTriangles).toBe(0);
    expect(sampled.indices).toHaveLength(20 * 20 * 6);
  });
  it("samples sideways step curves explicitly instead of drawing false zero contours", () => {
    expect(useGraphStore.getState().commitAutoEquation("x={0 for y<0;1 otherwise}").error).toBeNull();
    const [graph] = buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, {});
    expect(graph.swapAxes).toBe(true);
    expect(graph.implicitEvaluate).toBeNull();
    expect(graph.evaluate?.(-1)).toBeCloseTo(0);
    expect(graph.evaluate?.(0)).toBe(1);
  });
  it.each(["y={0 for x<0.13;1 otherwise}", "y={x for x<0; x+1 for x>1}", "y=1/(x-0.13)"])("SVG export starts separate paths across jumps and undefined intervals: %s", async equation => {
    expect(useGraphStore.getState().commitAutoEquation(equation).error).toBeNull();
    const result = export2dSvg({ objects: useGraphStore.getState().scene.objects, axisPair: "xy", viewport: { centerX: 0, centerY: 0, scale: 40 }, viewportFrame: { width: 600, height: 400 }, sceneName: "Cases" });
    const svg = await result.file!.blob.text();
    const path = svg.match(/<path d="([^"]+)" fill="none" stroke="#3b82f6"/);
    expect(path).not.toBeNull();
    expect(path![1].match(/M /g)!.length).toBeGreaterThanOrEqual(2);
  });
});
