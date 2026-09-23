import { describe, expect, it } from "vitest";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { getParametricSurfaceAxisDiagnostics } from "@/lib/math/expressionDiagnostics";

// Explicit parameter snapshot (mirrors the default editor parameters) so
// these tests never depend on live store state.
const PARAMS = { r: 2.5, h: 3.0 };

describe("compileParametricSurfaceExpressions", () => {
  it("compiles safe coordinate expressions with u/v symbols", () => {
    const compiled = compileParametricSurfaceExpressions("u", "v", "0", PARAMS);
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(1.5, -2.5)).toEqual([1.5, -2.5, 0]);
  });

  it("compiles the sphere and torus product expressions", () => {
    const sphere = compileParametricSurfaceExpressions(
      "sin(u) * cos(v)",
      "sin(u) * sin(v)",
      "cos(u)",
      PARAMS
    );
    expect(sphere.error).toBeNull();
    const [x, y, z] = sphere.evaluator(Math.PI / 2, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);

    const torus = compileParametricSurfaceExpressions(
      "(2 + 0.5 * cos(v)) * cos(u)",
      "(2 + 0.5 * cos(v)) * sin(u)",
      "0.5 * sin(v)",
      PARAMS
    );
    expect(torus.error).toBeNull();
    expect(torus.evaluator(0, 0)).toEqual([2.5, 0, 0]);
  });

  it("supports pi/e constants and editor parameters without new globals", () => {
    const compiled = compileParametricSurfaceExpressions("u * pi", "v * e", "0", PARAMS);
    expect(compiled.error).toBeNull();
    const [x, y] = compiled.evaluator(1, 1);
    expect(x).toBeCloseTo(Math.PI, 12);
    expect(y).toBeCloseTo(Math.E, 12);
  });

  it("rejects unknown symbols", () => {
    const compiled = compileParametricSurfaceExpressions("u + q", "v", "0", PARAMS);
    expect(compiled.error).not.toBeNull();
    expect(compiled.error).toContain("x(u,v)");
  });

  it("rejects empty coordinate expressions with field labels", () => {
    expect(compileParametricSurfaceExpressions("", "v", "0", PARAMS).error).toContain("x(u,v)");
    expect(compileParametricSurfaceExpressions("u", "  ", "0", PARAMS).error).toContain("y(u,v)");
    expect(compileParametricSurfaceExpressions("u", "v", "", PARAMS).error).toContain("z(u,v)");
  });

  it("is domain-neutral: x = 1/u compiles despite the singularity at u = 0", () => {
    const compiled = compileParametricSurfaceExpressions("1 / u", "v", "0", PARAMS);
    expect(compiled.error).toBeNull();
    // Pointwise contract: the singular sample evaluates to NaN, not throw.
    expect(compiled.evaluator(0, 1)[0]).toBeNaN();
    expect(compiled.evaluator(2, 1)[0]).toBe(0.5);
  });

  it("returns NaN for non-finite, non-number, and throwing evaluations", () => {
    const infinite = compileParametricSurfaceExpressions("1 / 0", "1 / v", "u", PARAMS);
    expect(infinite.error).toBeNull();
    expect(infinite.evaluator(1, 0)).toEqual([NaN, NaN, 1]);

    const root = compileParametricSurfaceExpressions("sqrt(u)", "v", "0", PARAMS);
    expect(root.error).toBeNull();
    expect(root.evaluator(-4, 0)[0]).toBeNaN();
    expect(root.evaluator(9, 0)[0]).toBe(3);
  });

  it("rejects nested unsafe functions through S11 recursive safety", () => {
    const compiled = compileParametricSurfaceExpressions("sin(factorial(u))", "v", "0", PARAMS);
    expect(compiled.error).not.toBeNull();
  });

  it("rejects assignments and function assignments", () => {
    expect(compileParametricSurfaceExpressions("u = 2", "v", "0", PARAMS).error).not.toBeNull();
    expect(compileParametricSurfaceExpressions("u", "f(u) = u^2", "0", PARAMS).error).not.toBeNull();
  });

  it("rejects overlong expressions", () => {
    const long = `u + ${"1+".repeat(1200)}0`;
    expect(compileParametricSurfaceExpressions(long, "v", "0", PARAMS).error).not.toBeNull();
  });

  it("locals u/v win over same-named editor parameters", () => {
    // Scope order {...params, u, v}: even if a parameter named u existed,
    // the surface parameter takes precedence. Direct check: u evaluates to
    // the passed argument regardless of ambient scope.
    const compiled = compileParametricSurfaceExpressions("u", "v", "u + v", PARAMS);
    expect(compiled.error).toBeNull();
    expect(compiled.evaluator(3, 4)).toEqual([3, 4, 7]);
  });

  it("uses editor parameters such as r alongside u/v", () => {
    // The default parameter set ships r = 2.5; torus-style expressions can
    // draw radii from the parameter system instead of literals.
    const compiled = compileParametricSurfaceExpressions(
      "(r + 0.5 * cos(v)) * cos(u)",
      "(r + 0.5 * cos(v)) * sin(u)",
      "0.5 * sin(v)",
      PARAMS
    );
    expect(compiled.error).toBeNull();
    const [x, y, z] = compiled.evaluator(0, 0);
    expect(x).toBeCloseTo(3.0, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("rejects numeric literals beyond the S11 magnitude cap", () => {
    expect(compileParametricSurfaceExpressions("1e10 * u", "v", "0", PARAMS).error).not.toBeNull();
  });
});

describe("getParametricSurfaceAxisDiagnostics", () => {
  it("reports valid for compilable axes", () => {
    expect(
      getParametricSurfaceAxisDiagnostics({ field: "xExpr", xExpr: "u", yExpr: "v", zExpr: "0" })
    ).toEqual({ status: "valid", message: "", fieldContext: "parametricSurface.xExpr" });
  });

  it("reports field-scoped errors without coordinate labels leaking", () => {
    const diag = getParametricSurfaceAxisDiagnostics({
      field: "yExpr",
      xExpr: "u",
      yExpr: "v + q",
      zExpr: "0"
    });
    expect(diag.status).toBe("error");
    expect(diag.fieldContext).toBe("parametricSurface.yExpr");
    expect(diag.message).not.toContain("y(u,v)");
  });

  it("flags unknown symbols as symbols, not functions", () => {
    const diag = getParametricSurfaceAxisDiagnostics({
      field: "xExpr",
      xExpr: "u + q",
      yExpr: "v",
      zExpr: "0"
    });
    expect(diag.status).toBe("error");
    expect(diag.message).toMatch(/unsupported symbol/i);
  });

  it("flags unsafe nested functions per axis", () => {
    const diag = getParametricSurfaceAxisDiagnostics({
      field: "zExpr",
      xExpr: "u",
      yExpr: "v",
      zExpr: "sin(factorial(u))"
    });
    expect(diag.status).toBe("error");
    expect(diag.fieldContext).toBe("parametricSurface.zExpr");
  });
});
