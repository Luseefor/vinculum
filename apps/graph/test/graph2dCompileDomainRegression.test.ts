import { describe, expect, it } from "vitest";
import { tryCompileMathExpression } from "@/components/graph/graph2d/graph2dCanvasCompile";
import {
  tryAppendExplicitCompiledCurve,
  tryAppendImplicitRenderableGraph
} from "@/components/graph/graph2d/equationRenderableBranches";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";
import { MAX_EXPRESSION_LENGTH } from "@/lib/math/expressionSafety";
import type { SurfaceGraphObject } from "@vinculum/scene/types";

// S9-U2: 2D compile-domain regression (TESTS ONLY).
//
// Same desired contract as surfaces: the shared 2D compile helper must not
// reject a structurally valid expression merely because it is non-finite at
// the fixed (0,0,0,0) probe. Pointwise validity belongs to the per-point
// evaluate closures, which already return null on non-finite/throw.
//
// Tests marked DESIRED FAIL pre-fix (F1). CONTROL / SECURITY pass pre-fix.

function makeSurfaceObject(id: string, equation: string): SurfaceGraphObject {
  return {
    id,
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 24,
    appearance: { wireframe: false },
    orientation: "z"
  };
}

describe("S9-U2-F 2D explicit helper (domain-neutral compilation)", () => {
  it("1/x compiles; x=0 invalid at runtime, x!=0 finite", () => {
    const compiled = tryCompileMathExpression("1/x");
    expect(compiled).not.toBeNull();
    if (!compiled) {
      return;
    }
    const atZero = compiled.evaluate({ x: 0, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E });
    expect(Number.isFinite(typeof atZero === "number" ? atZero : Number(atZero))).toBe(false);
    const atTwo = compiled.evaluate({ x: 2, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E });
    expect(typeof atTwo === "number" ? atTwo : Number(atTwo)).toBeCloseTo(0.5, 12);
  });

  it("explicit branch appends for 1/x with null-at-zero runtime semantics", () => {
    const obj = makeSurfaceObject("s9-2d-explicit", "y = 1/x");
    const axisPair = getAxisPairSpec("xy");
    const graphs: RenderableGraph[] = [];
    // numericSource is the surface body with the dependent prefix stripped,
    // matching buildRenderableGraphsFromScene behavior.
    const appended = tryAppendExplicitCompiledCurve(graphs, obj, axisPair, "y", "1/x");
    expect(appended).toBe(true);
    const evaluate = graphs[0]?.evaluate;
    expect(evaluate).not.toBeNull();
    expect(evaluate?.(0)).toBeNull();
    expect(evaluate?.(1)).toBeCloseTo(1, 9);
    expect(evaluate?.(-2)).toBeCloseTo(-0.5, 9);
  });
});

describe("S9-U2-F shifted explicit control (CONTROL, passes pre-fix)", () => {
  it("1/(x-1) compiles; invalid only at x=1", () => {
    const compiled = tryCompileMathExpression("1/(x - 1)");
    expect(compiled).not.toBeNull();
    if (!compiled) {
      return;
    }
    const scope = (x: number) => ({ x, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E });
    const atOne = compiled.evaluate(scope(1));
    expect(Number.isFinite(typeof atOne === "number" ? atOne : Number(atOne))).toBe(false);
    const atTwo = compiled.evaluate(scope(2));
    expect(typeof atTwo === "number" ? atTwo : Number(atTwo)).toBeCloseTo(1, 12);
  });

  it("explicit branch appends for 1/(x-1) today", () => {
    const obj = makeSurfaceObject("s9-2d-shifted", "y = 1/(x - 1)");
    const graphs: RenderableGraph[] = [];
    expect(tryAppendExplicitCompiledCurve(graphs, obj, getAxisPairSpec("xy"), "y", "1/(x - 1)")).toBe(true);
    expect(graphs[0]?.evaluate?.(1)).toBeNull();
    expect(graphs[0]?.evaluate?.(2)).toBeCloseTo(1, 9);
  });
});

describe("S9-U2-G 2D rendering contract (domain-neutral compilation)", () => {
  it("y = 1/x yields a renderable explicit curve with broken-at-zero semantics", () => {
    const obj = makeSurfaceObject("s9-2d-render", "y = 1/x");
    const graphs = buildRenderableGraphsFromScene([obj], getAxisPairSpec("xy"));
    const curve = graphs.find((graph) => graph.id === obj.id && graph.evaluate !== null);
    expect(curve).toBeDefined();
    // The draw layer breaks segments on null (see
    // graph2dCanvasDrawRenderableGraphExplicitCurve), so null-at-zero is the
    // no-segment-through-the-pole contract — no adaptive sampling required.
    expect(curve?.evaluate?.(0)).toBeNull();
    expect(curve?.evaluate?.(-1)).toBeCloseTo(-1, 9);
    expect(curve?.evaluate?.(1)).toBeCloseTo(1, 9);
  });
});

describe("S9-U2-H 2D implicit with origin-singular side (domain-neutral compilation)", () => {
  it("1/x = 1 appends; singular points skipped, x=1 contour valid", () => {
    const obj = makeSurfaceObject("s9-2d-implicit", "1/x = 1");
    const graphs: RenderableGraph[] = [];
    const appended = tryAppendImplicitRenderableGraph(graphs, obj, getAxisPairSpec("xy"), "1/x = 1");
    expect(appended).toBe(true);
    const implicitEvaluate = graphs[0]?.implicitEvaluate;
    expect(implicitEvaluate).not.toBeNull();
    // Zero set x=1 for all y; the singular line x=0 evaluates to null.
    expect(implicitEvaluate?.(1, 0)).toBeCloseTo(0, 9);
    expect(implicitEvaluate?.(1, 3)).toBeCloseTo(0, 9);
    expect(implicitEvaluate?.(0, 0)).toBeNull();
  });

  it("non-singular implicit circle still appends (CONTROL, passes pre-fix)", () => {
    const obj = makeSurfaceObject("s9-2d-circle", "x^2 + y^2 = 1");
    const graphs: RenderableGraph[] = [];
    expect(
      tryAppendImplicitRenderableGraph(graphs, obj, getAxisPairSpec("xy"), "x^2 + y^2 = 1")
    ).toBe(true);
    expect(graphs[0]?.implicitEvaluate?.(1, 0)).toBeCloseTo(0, 9);
  });
});

describe("S9-U2-I 2D probe-location pair (domain-neutral compilation)", () => {
  it.each([
    { expression: "1/x", singularAt: 0 },
    { expression: "1/(x - 1)", singularAt: 1 }
  ])("$expression accepted; runtime validity differs only at x=$singularAt", ({ expression, singularAt }) => {
    const compiled = tryCompileMathExpression(expression);
    expect(compiled).not.toBeNull();
    if (!compiled) {
      return;
    }
    const scope = (x: number) => ({ x, y: 0, z: 0, t: 0, pi: Math.PI, e: Math.E });
    const atSingular = compiled.evaluate(scope(singularAt));
    expect(Number.isFinite(typeof atSingular === "number" ? atSingular : Number(atSingular))).toBe(false);
    const away = compiled.evaluate(scope(singularAt + 2));
    expect(Number.isFinite(typeof away === "number" ? away : Number(away))).toBe(true);
  });
});

describe("S9-U2-J 2D security matrix (SECURITY, passes pre-fix)", () => {
  it.each([
    { label: "syntax error", expression: "sin(" },
    { label: "unsupported function", expression: "factorial(5)" },
    { label: "unknown symbol", expression: "w + 1" },
    { label: "assignment", expression: "x = 2" }
  ])("still rejects $label", ({ expression }) => {
    expect(tryCompileMathExpression(expression)).toBeNull();
  });

  it("still rejects overlong expressions", () => {
    const chunk = "sin(x)+";
    const times = Math.ceil((MAX_EXPRESSION_LENGTH + 1) / chunk.length);
    expect(tryCompileMathExpression(`${chunk.repeat(times)}0`)).toBeNull();
  });
});
