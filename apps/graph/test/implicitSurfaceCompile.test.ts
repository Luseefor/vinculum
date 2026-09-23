import { describe, expect, it } from "vitest";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { getImplicitSurfaceEquationDiagnostics } from "@/lib/math/expressionDiagnostics";
import { splitSingleMathEquality } from "@/lib/math/implicitEquation";

describe("splitSingleMathEquality", () => {
  it("splits exactly one equality with non-empty sides", () => {
    expect(splitSingleMathEquality("x^2 + y^2 + z^2 = 1")).toEqual({
      lhs: "x^2 + y^2 + z^2",
      rhs: "1"
    });
    expect(splitSingleMathEquality("x^2+y^2+z^2-1")).toBeNull();
  });

  it("rejects chained, comparison, and missing-side forms", () => {
    expect(splitSingleMathEquality("x = y = z")).toBeNull();
    expect(splitSingleMathEquality("x == 1")).toBeNull();
    expect(splitSingleMathEquality("x =")).toBeNull();
    expect(splitSingleMathEquality("= 1")).toBeNull();
    expect(splitSingleMathEquality("")).toBeNull();
  });
});

describe("compileImplicitSurfaceExpression", () => {
  it("compiles a bare scalar field", () => {
    const compiled = compileImplicitSurfaceExpression("x^2 + y^2 + z^2 - 1");
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(1, 0, 0)).toBeCloseTo(0, 12);
    expect(compiled.evaluator(0, 0, 0)).toBeCloseTo(-1, 12);
  });

  it("normalizes mathematical equality to lhs - rhs for evaluation", () => {
    const compiled = compileImplicitSurfaceExpression("x^2 + y^2 + z^2 = 1");
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(1, 0, 0)).toBeCloseTo(0, 12);
    expect(compiled.evaluator(0, 0, 0)).toBeCloseTo(-1, 12);
    expect(compiled.evaluator(2, 0, 0)).toBeCloseTo(3, 12);
  });

  it("supports x/y/z locals, pi/e constants, and editor parameters", () => {
    const compiled = compileImplicitSurfaceExpression("x^2 + y^2 + z^2 = r^2");
    expect(compiled.error).toBeNull();
    // Default parameter set ships r = 2.5.
    expect(compiled.evaluator(2.5, 0, 0)).toBeCloseTo(0, 12);
    const trig = compileImplicitSurfaceExpression("sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0");
    expect(trig.error).toBeNull();
    expect(trig.evaluator(0, 0, 0)).toBeCloseTo(0, 12);
  });

  it("rejects unknown symbols without allowing them through", () => {
    const compiled = compileImplicitSurfaceExpression("x^2 + w^2 = 1");
    expect(compiled.error).not.toBeNull();
  });

  it("does not admit u/v/t locals", () => {
    expect(compileImplicitSurfaceExpression("u + v = 0").error).not.toBeNull();
    const tRejected = compileImplicitSurfaceExpression("t + x = 0");
    expect(tRejected.error).not.toBeNull();
    expect(tRejected.error).toMatch(/'t' is not supported/i);
  });

  it("rejects nested unsafe functions through S11 recursive safety", () => {
    expect(compileImplicitSurfaceExpression("sin(factorial(x)) + y + z = 0").error).not.toBeNull();
    expect(compileImplicitSurfaceExpression("sin(factorial(x)) + y + z").error).not.toBeNull();
  });

  it("rejects assignments, function assignments, and malformed equality", () => {
    expect(compileImplicitSurfaceExpression("x = y = z").error).not.toBeNull();
    expect(compileImplicitSurfaceExpression("x == 1").error).not.toBeNull();
    expect(compileImplicitSurfaceExpression("x =").error).not.toBeNull();
    expect(compileImplicitSurfaceExpression("= 1").error).not.toBeNull();
    expect(compileImplicitSurfaceExpression("f(x) = x^2").error).not.toBeNull();
  });

  it("rejects empty equations", () => {
    expect(compileImplicitSurfaceExpression("   ").error).toContain("empty");
  });

  it("is domain-neutral: 1/x compiles despite the singularity at x = 0", () => {
    const compiled = compileImplicitSurfaceExpression("1 / x");
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(0, 0, 0)).toBeNaN();
    expect(compiled.evaluator(2, 0, 0)).toBe(0.5);
  });

  it("returns NaN for non-finite, non-number, and throwing evaluations", () => {
    const infinite = compileImplicitSurfaceExpression("1 / 0");
    expect(infinite.error).toBeNull();
    expect(infinite.evaluator(1, 2, 3)).toBeNaN();
    const root = compileImplicitSurfaceExpression("sqrt(x) + y + z");
    expect(root.error).toBeNull();
    expect(root.evaluator(-4, 0, 0)).toBeNaN();
    expect(root.evaluator(9, 0, 0)).toBe(3);
  });

  it("rejects oversized numeric literals and overlong expressions", () => {
    expect(compileImplicitSurfaceExpression("1e10 * x + y + z").error).not.toBeNull();
    const long = `x + y + z + ${"1+".repeat(1200)}0`;
    expect(compileImplicitSurfaceExpression(long).error).not.toBeNull();
  });

  it("locals win over same-named editor parameters", () => {
    const compiled = compileImplicitSurfaceExpression("x + y + z");
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(1, 2, 3)).toBe(6);
  });
});

describe("getImplicitSurfaceEquationDiagnostics", () => {
  it("reports valid for bare fields and equalities", () => {
    expect(getImplicitSurfaceEquationDiagnostics("x^2 + y^2 + z^2 - 1")).toEqual({
      status: "valid",
      message: "",
      fieldContext: "implicitSurface.equation"
    });
    expect(getImplicitSurfaceEquationDiagnostics("x^2 + y^2 + z^2 = 1").status).toBe("valid");
  });

  it("reports malformed equality distinctly from syntax errors", () => {
    const chained = getImplicitSurfaceEquationDiagnostics("x = y = z");
    expect(chained.status).toBe("error");
    expect(chained.message).toMatch(/exactly one/i);
    const comparison = getImplicitSurfaceEquationDiagnostics("x == 1");
    expect(comparison.status).toBe("error");
    const missing = getImplicitSurfaceEquationDiagnostics("x =");
    expect(missing.status).toBe("error");
  });

  it("flags unsafe nested functions with field context", () => {
    const diag = getImplicitSurfaceEquationDiagnostics("sin(factorial(x)) + y + z = 0");
    expect(diag.status).toBe("error");
    expect(diag.fieldContext).toBe("implicitSurface.equation");
  });

  it("flags unknown symbols as symbols", () => {
    const diag = getImplicitSurfaceEquationDiagnostics("x^2 + w^2 = 1");
    expect(diag.status).toBe("error");
    expect(diag.message).toMatch(/unsupported symbol/i);
  });
});
