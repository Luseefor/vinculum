import { describe, expect, it } from "vitest";
import {
  MAX_EXPRESSION_LENGTH,
  validateExpressionSafety
} from "@/lib/math/expressionSafety";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { tryCompileMathExpression } from "@/components/graph/graph2d/graph2dCanvasCompile";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { validateSceneDocument } from "@/lib/scene/validateScene";
import type { GraphObject } from "@vinculum/scene/types";

// S11: recursive expression-safety enforcement regressions (TESTS ONLY for
// this file; production fix is the traverse-based walk in
// expressionSafety.ts).
//
// Contract: the safety POLICY applies to EVERY reachable AST node. A
// prohibited construct nested at any depth must fail with the same policy
// error as its shallow equivalent. Safe nesting at any depth must pass.

const XYZT = ["x", "y", "z", "t"];

function safetyOf(expression: string, allowedSymbols: string[] = XYZT) {
  return validateExpressionSafety(expression, {
    operation: "s11-trace",
    expressionLabel: "s11",
    allowedSymbols
  });
}

function sceneErrors(objects: GraphObject[]): string[] {
  const scene = createSceneDocument({ metadata: { name: "s11" }, objects });
  return validateSceneDocument(JSON.parse(serializeScene(scene)) as unknown).errors;
}

describe("S11 function whitelist at any depth", () => {
  it.each([
    "factorial(5)",
    "sin(factorial(5))",
    "cos(sin(factorial(5)))",
    "sqrt(abs(sin(factorial(5))))",
    "1 + sin(max(2, factorial(4)))"
  ])("rejects %s as unsupported function", (expression) => {
    const result = safetyOf(expression);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("unsupported-function");
    expect(result.violation.message).toMatch(/Unsupported function: factorial/);
  });
});

describe("S11 unknown symbols at any depth", () => {
  it.each(["w", "sin(w)", "cos(sin(w))", "sin(cos(w))"])("rejects %s", (expression) => {
    const result = safetyOf(expression);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("unsupported-symbol");
  });
});

describe("S11 literal magnitude at any depth", () => {
  it.each(["1000000001", "sin(1000000001)", "cos(sin(1000000001))"])("rejects %s", (expression) => {
    const result = safetyOf(expression);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("numeric-literal-out-of-range");
  });

  it.each(["999999999", "sin(cos(999999999))"])("accepts in-limit %s", (expression) => {
    expect(safetyOf(expression).ok).toBe(true);
  });
});

describe("S11 disallowed node types at any depth", () => {
  it.each([
    "sin((x = 2))",
    "sin(([1, 2]))",
    "sin(({a: 1}))",
    "sin((1:5))"
  ])("rejects nested %s", (expression) => {
    const result = safetyOf(expression);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.violation.code).toBe("expression-disallowed-node");
  });
});

describe("S11 deep safe nesting", () => {
  it.each([
    "sin(cos(x))",
    "sqrt(abs(x))",
    "exp(sin(x))",
    "min(max(x, -1), 1)",
    "pow(abs(x), 2)",
    "sin(cos(sqrt(abs(sin(cos(x))))))"
  ])("accepts %s", (expression) => {
    expect(safetyOf(expression).ok).toBe(true);
  });
});

describe("S11 node-count cap accounting", () => {
  it("densest legal expression under the length cap still passes (defense-in-depth)", () => {
    // ~1 AST node per char: even the longest admissible input stays below
    // MAX_AST_NODE_COUNT, so the complexity cap remains unreachable behind
    // the length cap. Full recursive counting must not change that.
    const dense = `${"x+".repeat(1023)}x`;
    expect(dense.length).toBeLessThanOrEqual(MAX_EXPRESSION_LENGTH);
    expect(safetyOf(dense).ok).toBe(true);
  });
});

describe("S11 cross-compiler propagation", () => {
  it("surface compiler rejects nested unsupported functions, keeps S9 behavior", () => {
    expect(compileSurfaceExpression("sin(cos(factorial(x)))", "z").error).toMatch(/Unsupported function: factorial/);
    expect(compileSurfaceExpression("sin(cos(x))", "z").error).toBeNull();
    expect(compileSurfaceExpression("1/(x^2+y^2)", "z").error).toBeNull();
  });

  it("parametric compiler rejects nested unsupported functions, keeps S6 behavior", () => {
    expect(compileParametricExpressions("t", "sin(factorial(t))", "0").error).toMatch(/factorial/);
    expect(compileParametricExpressions("t", "sin(cos(t))", "0").error).toBeNull();
    expect(compileParametricExpressions("t", "1/t", "0").error).toBeNull();
  });

  it("2D helper rejects nested unsupported functions, keeps throw guard", () => {
    expect(tryCompileMathExpression("sin(cos(factorial(x)))")).toBeNull();
    expect(tryCompileMathExpression("1/x")).not.toBeNull();
    // No symbol whitelist here by design; unknown symbols still fail via
    // the retained smoke-evaluation throw guard, not the safety layer.
    expect(tryCompileMathExpression("cos(sin(w))")).toBeNull();
  });

  it("plane compiler rejects nested unsupported functions", () => {
    expect(compilePlaneEquation("z = sin(factorial(x))").error).toMatch(/Unsupported function: factorial/);
    expect(compilePlaneEquation("z = 0").error).toBeNull();
  });
});

describe("S11 S10 interaction", () => {
  it("implicit equation with unsafe side still rejected", () => {
    expect(sceneErrors([createSurfaceGraph({ equation: "sin(factorial(x)) = 1" })]).length).toBeGreaterThan(0);
  });

  it("valid S10 equations still validate", () => {
    expect(sceneErrors([createSurfaceGraph({ equation: "x^2 + y^2 = 1" })])).toEqual([]);
    expect(sceneErrors([createPlaneGraph({ equation: "z = 0" })])).toEqual([]);
  });
});
