import { describe, expect, it } from "vitest";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import type { SurfaceEvaluator } from "@/lib/math/compileExpressionTypes";
import {
  MAX_EXPRESSION_LENGTH,
  validateExpressionSafety
} from "@/lib/math/expressionSafety";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { buildSurface } from "@/lib/graph3d/buildGraphSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { Mesh } from "three";
import type { SurfaceGraphObject } from "@vinculum/scene/types";

// S9-U2: surface compile-domain regression (TESTS ONLY).
//
// Desired contract: compilation answers whether an expression is
// syntactically valid, structurally allowed, safe, and compilable.
// Pointwise finiteness belongs to sampling. A non-finite value at one
// arbitrary probe point must NOT invalidate the whole function.
//
// Tests marked DESIRED FAIL pre-fix (F1): the origin probe rejects them.
// Tests marked CONTROL / CHARACTERIZATION / SECURITY pass pre-fix and must
// keep passing after the fix.

function makeSurfaceObject(equation: string): SurfaceGraphObject {
  return {
    id: "s9-surface",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
    resolution: 4,
    appearance: { wireframe: false },
    orientation: "z"
  };
}

function findSurfaceMesh(object: SurfaceGraphObject): Mesh | null {
  const group = buildSurface(object, "dark", getGraphThemeTokens("dark"));
  if (!group) {
    return null;
  }
  let mesh: Mesh | null = null;
  group.traverse((child) => {
    if (mesh === null && child instanceof Mesh) {
      mesh = child;
    }
  });
  return mesh;
}

describe("S9-U2-A origin singularity (domain-neutral compilation)", () => {
  it("1/(x^2+y^2) compiles; origin evaluates invalid, elsewhere finite", () => {
    const compiled = compileSurfaceExpression("1 / (x^2 + y^2)", "z");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(0, 0)).toBeNaN();
    expect(compiled.evaluator(1, 0)).toBeCloseTo(1, 12);
    expect(compiled.evaluator(0, 1)).toBeCloseTo(1, 12);
    expect(compiled.evaluator(1, 1)).toBeCloseTo(0.5, 12);
  });
});

describe("S9-U2-B shifted singularity control (CONTROL, passes pre-fix)", () => {
  it("1/((x-1)^2+(y-1)^2) compiles; invalid only at (1,1)", () => {
    const compiled = compileSurfaceExpression("1 / ((x - 1)^2 + (y - 1)^2)", "z");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    expect(compiled.evaluator(0, 0)).toBeCloseTo(0.5, 12);
    expect(compiled.evaluator(1, 1)).toBeNaN();
    expect(compiled.evaluator(2, 1)).toBeCloseTo(1, 12);
  });
});

describe("S9-U2-C orientation matrix (domain-neutral compilation)", () => {
  it.each([
    {
      orientation: "z" as const,
      expression: "1 / (x^2 + y^2)",
      singular: [0, 0] as const,
      finite: [1, 0] as const
    },
    {
      orientation: "y" as const,
      expression: "1 / (x^2 + z^2)",
      singular: [0, 0] as const,
      finite: [1, 0] as const
    },
    {
      orientation: "x" as const,
      expression: "1 / (y^2 + z^2)",
      singular: [0, 0] as const,
      finite: [0, 1] as const
    }
  ])(
    "$orientation-oriented origin singularity compiles; singular pair NaN, ordinary pair finite",
    ({ orientation, expression, singular, finite }) => {
      const compiled = compileSurfaceExpression(expression, orientation);
      expect(compiled.error).toBeNull();
      if (compiled.error) {
        return;
      }
      expect(compiled.evaluator(singular[0], singular[1])).toBeNaN();
      expect(Number.isFinite(compiled.evaluator(finite[0], finite[1]))).toBe(true);
    }
  );
});

describe("S9-U2-D constant non-finite expression (domain-neutral compilation)", () => {
  it("1/0 compiles structurally; evaluator is NaN everywhere", () => {
    const compiled = compileSurfaceExpression("1 / 0", "z");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    for (const [u, v] of [[-5, 0], [0, 0], [5, 5]] as const) {
      expect(compiled.evaluator(u, v)).toBeNaN();
    }
  });

  it("nowhere-finite sampling yields no triangles and no mesh", () => {
    const compiled = compileSurfaceExpression("1 / 0", "z");
    expect(compiled.error).toBeNull();
    if (compiled.error) {
      return;
    }
    const sampled = sampleSurface(compiled.evaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 4
    });
    expect(sampled.indices.length).toBe(0);
    // No NaN/Infinity may leak into stored positions even when nothing renders.
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }
    expect(findSurfaceMesh(makeSurfaceObject("1 / 0"))).toBeNull();
  });
});

describe("S9-U2-E sampler safety with post-fix-shaped evaluator (CHARACTERIZATION, passes pre-fix)", () => {
  // Mirrors the production evaluator contract (compileExpression.ts):
  // throw/non-finite/non-numeric coerce to NaN per sample.
  const postFixShapedEvaluator: SurfaceEvaluator = (u, v) => {
    const d = u * u + v * v;
    const result = 1 / d;
    return Number.isFinite(result) ? result : Number.NaN;
  };

  it("origin sample invalid with finite placeholder; neighbors still triangulate; buffers stay finite", () => {
    const sampled = sampleSurface(postFixShapedEvaluator, {
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 4
    });
    const stride = 5;
    const originVertex = 2 * stride + 2;
    // Placeholder at invalidHeight (default 0) is finite storage, not a leak.
    expect(Number.isFinite(sampled.positions[originVertex * 3])).toBe(true);
    expect(Number.isFinite(sampled.positions[originVertex * 3 + 1])).toBe(true);
    expect(Number.isFinite(sampled.positions[originVertex * 3 + 2])).toBe(true);
    // No triangle may reference the invalid origin sample.
    for (let i = 0; i < sampled.indices.length; i += 1) {
      expect(sampled.indices[i]).not.toBe(originVertex);
    }
    // Valid regions away from the pole still produce triangles.
    expect(sampled.indices.length).toBeGreaterThan(0);
    // No NaN/Infinity anywhere in the stored buffer.
    for (let i = 0; i < sampled.positions.length; i += 1) {
      expect(Number.isFinite(sampled.positions[i])).toBe(true);
    }
  });
});

describe("S9-U2-J surface security matrix (SECURITY, passes pre-fix)", () => {
  // NOTE: `x = 2` / `f(x) = ...` never reach the compiler's safety check:
  // orientation normalization strips an explicit/implicit `... =` prefix
  // first (separate normalization behavior, out of scope). The sandbox
  // beneath still rejects the raw assignment ASTs (see below); forms that
  // do reach the compiler are rejected there.
  it.each([
    { label: "syntax error", expression: "sin(", match: /Invalid expression syntax/i },
    { label: "reversed assignment", expression: "2 = x", match: /Invalid expression syntax/i },
    { label: "unsupported function", expression: "factorial(5)", match: /Unsupported function: factorial/i },
    { label: "unknown symbol", expression: "w + 1", match: /Unsupported symbol: w/i },
    { label: "huge literal", expression: "x + 2000000000", match: /too large/i }
  ])("still rejects $label", ({ expression, match }) => {
    const { error } = compileSurfaceExpression(expression, "z");
    expect(error).not.toBeNull();
    expect(error ?? "").toMatch(match);
  });

  it("safety layer still rejects raw assignment ASTs beneath normalization", () => {
    for (const expression of ["x = 2", "f(x) = x^2"]) {
      const safety = validateExpressionSafety(expression, {
        operation: "s9-u2-trace",
        expressionLabel: "trace"
      });
      expect(safety.ok).toBe(false);
      if (safety.ok) {
        continue;
      }
      expect(safety.violation.code).toBe("expression-disallowed-node");
    }
  });

  it("still rejects overlong expressions", () => {
    const chunk = "sin(x)+";
    const times = Math.ceil((MAX_EXPRESSION_LENGTH + 1) / chunk.length);
    const { error } = compileSurfaceExpression(`z = ${chunk.repeat(times)}0`, "z");
    expect(error).toMatch(/Expression is too long/i);
  });

  it("documents that the node-count cap is unreachable under the length cap", () => {
    // Densest legal shape (~1 AST node per char): even the longest
    // admissible expression stays below MAX_AST_NODE_COUNT, so the
    // complexity cap is defense-in-depth behind the length cap.
    const dense = `${"x+".repeat(1023)}x`;
    expect(dense.length).toBeLessThanOrEqual(MAX_EXPRESSION_LENGTH);
    const safety = validateExpressionSafety(dense, {
      operation: "s9-u2-trace",
      expressionLabel: "trace"
    });
    expect(safety.ok).toBe(true);
  });
});

describe("S9-U2-K construction-time failure (CHARACTERIZATION)", () => {
  it("documents whether safe-AST input can make mathjs compile() itself throw", () => {
    // Battery of structurally tricky but whitelisted expressions: none of
    // these should fail at mathjs compile() construction. If any future
    // input does, compile() failure must remain a compile error.
    const candidates = [
      "sin(cos(tan(x)))",
      "(((((((((x)))))))))",
      "max(min(x, y), sin(x))",
      "pow(x, y)",
      "sign(x) + floor(y) + ceil(x) + round(y)",
      "log(exp(x))",
      "sqrt(abs(x))"
    ];
    const constructionFailures: string[] = [];
    for (const expression of candidates) {
      const { error } = compileSurfaceExpression(expression, "z");
      if (error !== null && !error.includes("non-finite")) {
        constructionFailures.push(`${expression} -> ${error}`);
      }
    }
    // NOT REPRODUCIBLE UNDER CURRENT ALLOWED AST: every candidate either
    // compiles or fails only via the probe-finiteness gate.
    expect(constructionFailures).toEqual([]);
  });
});

describe("S9-U2-N current error characterization (POST-FIX, passes after S9-U3)", () => {
  it("origin-singular surface no longer fails with the non-finite probe error", () => {
    const { error } = compileSurfaceExpression("1 / (x^2 + y^2)", "z");
    // S9-U3 retired the fixed-point finiteness gate at the compiler layer:
    // domain singularities compile with error === null and the sampler
    // determines renderability. (Pre-fix this was
    // "Expression produced a non-finite value.")
    expect(error).toBeNull();
  });
});
