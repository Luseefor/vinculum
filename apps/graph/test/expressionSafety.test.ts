import { describe, expect, it } from "vitest";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { MAX_EXPRESSION_LENGTH, MAX_PARAMETRIC_CURVE_SAMPLES } from "@/lib/math/expressionSafety";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";

describe("expression safety", () => {
  it("valid surface expression compiles and evaluates", () => {
    const { error, evaluator } = compileSurfaceExpression("z = sin(x) * cos(y)", "z");
    expect(error).toBeNull();
    expect(Number.isFinite(evaluator(1, 2))).toBe(true);
  });

  it("rejects overlong surface expressions", () => {
    const chunk = "sin(x)+";
    const times = Math.ceil((MAX_EXPRESSION_LENGTH + 1) / chunk.length);
    const body = `${chunk.repeat(times)}0`;
    const { error } = compileSurfaceExpression(`z = ${body}`, "z");
    expect(error).toMatch(/Expression is too long/i);
  });

  it("rejects unsupported functions", () => {
    const { error } = compileSurfaceExpression("z = factorial(5)", "z");
    expect(error).toMatch(/Unsupported function: factorial/i);
    expect(error).not.toMatch(/\bat\b|stack/i);
  });

  it("rejects malformed expression syntax", () => {
    const { error } = compileSurfaceExpression("z = sin(", "z");
    expect(error).toMatch(/Invalid expression syntax/i);
  });

  it("rejects non-finite results from surface evaluation", () => {
    const { error } = compileSurfaceExpression("z = 1/0", "z");
    expect(error).toMatch(/Expression produced a non-finite value/i);
  });

  it("rejects non-finite results from parametric axis evaluation", () => {
    const compiled = compileParametricExpressions("1/0", "0", "0");
    expect(compiled.error).toMatch(/Expression produced a non-finite value/i);
  });

  it("rejects overlong imported scene surface expressions", () => {
    const chunk = "sin(x)+";
    const times = Math.ceil((MAX_EXPRESSION_LENGTH + 1) / chunk.length);
    const body = `${chunk.repeat(times)}0`;
    const scene = createSceneDocument({
      metadata: { name: "Overlong expression scene" },
      objects: [createSurfaceGraph({ equation: body })]
    });

    const parsed = deserializeScene(serializeScene(scene));
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.errors.join(" ")).toMatch(/Expression is too long/i);
  });

  it("rejects oversized imported parametric curve samples", () => {
    const scene = createSceneDocument({
      metadata: { name: "Oversized samples scene" },
      objects: [
        createParametricCurve({
          xExpr: "t",
          yExpr: "0",
          zExpr: "0",
          samples: MAX_PARAMETRIC_CURVE_SAMPLES + 1
        })
      ]
    });

    const parsed = deserializeScene(serializeScene(scene));
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.errors.join(" ")).toMatch(/Resolution is too high/i);
  });

  it("caps parametric curve sampling to prevent freezing", () => {
    const evaluator = (_t: number) => [0, 0, 0] as [number, number, number];
    expect(() =>
      sampleCurve(evaluator, {
        tMin: 0,
        tMax: 1,
        samples: MAX_PARAMETRIC_CURVE_SAMPLES + 1
      })
    ).toThrow(/Resolution is too high/i);
  });
});

