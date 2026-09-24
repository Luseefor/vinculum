import { describe, expect, it } from "vitest";
import { compilePartialDerivative } from "@/lib/math/compilePartialDerivative";

function at(
  expression: string,
  variable: string,
  scope: Record<string, number>,
  params: Record<string, number> = {},
  allowedSymbols: string[] = ["x", "y", "z"]
): number | null {
  const compiled = compilePartialDerivative({ expression, variable, allowedSymbols, params });
  expect(compiled.error).toBeNull();
  return compiled.evaluate(scope);
}

describe("compilePartialDerivative (S21 Slice 1)", () => {
  it("differentiates polynomials: d/dx x^3 = 3x^2", () => {
    expect(at("x^3", "x", { x: 2 })).toBeCloseTo(12, 12);
    expect(at("x^3", "y", { x: 2, y: 5 })).toBe(0);
  });

  it("differentiates trig: d/dx sin(x) = cos(x)", () => {
    expect(at("sin(x)", "x", { x: 0 })).toBeCloseTo(1, 12);
    expect(at("cos(x)", "x", { x: 0 })).toBeCloseTo(0, 12);
  });

  it("differentiates exp and valid log/sqrt", () => {
    expect(at("exp(2*x)", "x", { x: 1 })).toBeCloseTo(2 * Math.exp(2), 10);
    expect(at("log(x)", "x", { x: 2 })).toBeCloseTo(0.5, 12);
    expect(at("sqrt(x)", "x", { x: 4 })).toBeCloseTo(0.25, 12);
  });

  it("differentiates mixed expressions per variable", () => {
    // F = x^2*y + sin(y): Fx = 2xy, Fy = x^2 + cos(y).
    expect(at("x^2*y + sin(y)", "x", { x: 3, y: 1 })).toBeCloseTo(6, 10);
    expect(at("x^2*y + sin(y)", "y", { x: 3, y: 1 })).toBeCloseTo(9 + Math.cos(1), 10);
  });

  it("treats parameters as constants from the snapshot", () => {
    // z = a*x^2 + y^2, a = 3, at (2,1): fx = 12, fy = 2.
    const allowed = ["a", "x", "y"];
    expect(at("a*x^2 + y^2", "x", { a: 3, x: 2, y: 1 }, { a: 3 }, allowed)).toBeCloseTo(12, 10);
    expect(at("a*x^2 + y^2", "y", { a: 3, x: 2, y: 1 }, { a: 3 }, allowed)).toBeCloseTo(2, 10);
  });

  it("differentiates nested compositions by value: d/dx sin(x^2) = 2x·cos(x^2)", () => {
    expect(at("sin(x^2)", "x", { x: 1 })).toBeCloseTo(2 * Math.cos(1), 10);
    expect(at("exp(sin(x))", "x", { x: 0 })).toBeCloseTo(1, 12);
  });

  it("returns NaN (never throws) on domain failure", () => {
    const compiled = compilePartialDerivative({
      expression: "1/x",
      variable: "x",
      allowedSymbols: ["x"],
      params: {}
    });
    expect(compiled.error).toBeNull();
    expect(Number.isNaN(compiled.evaluate({ x: 0 }))).toBe(true);
    expect(() => compiled.evaluate({ x: 0 })).not.toThrow();
  });

  it("reports unavailable for rule-less functions without fallback", () => {
    for (const expression of ["sign(x)", "floor(x)", "max(x, y)"]) {
      const compiled = compilePartialDerivative({
        expression,
        variable: "x",
        allowedSymbols: ["x", "y"],
        params: {}
      });
      expect(compiled.error).toMatch(/unavailable/i);
    }
  });

  it("reports unavailable when generated math leaves the whitelist (tan -> sec)", () => {
    const compiled = compilePartialDerivative({
      expression: "tan(x)",
      variable: "x",
      allowedSymbols: ["x"],
      params: {}
    });
    expect(compiled.error).toMatch(/unavailable/i);
    expect(compiled.error).toMatch(/sec/i);
  });

  it("fails nested unsafe at the source compiler before analysis", () => {
    const compiled = compilePartialDerivative({
      expression: "sin(factorial(x))",
      variable: "x",
      allowedSymbols: ["x"],
      params: {}
    });
    expect(compiled.error).toMatch(/factorial/i);
  });

  it("rejects empty expressions and unknown symbols", () => {
    expect(
      compilePartialDerivative({ expression: "", variable: "x", allowedSymbols: ["x"], params: {} }).error
    ).not.toBeNull();
    expect(
      compilePartialDerivative({ expression: "zzz", variable: "x", allowedSymbols: ["x"], params: {} }).error
    ).toMatch(/symbol/i);
  });

  it("caches by expression, variable, and parameter snapshot", () => {
    const first = compilePartialDerivative({ expression: "x^2", variable: "x", allowedSymbols: ["x"], params: {} });
    const second = compilePartialDerivative({ expression: "x^2", variable: "x", allowedSymbols: ["x"], params: {} });
    expect(second).toBe(first);
    const otherVar = compilePartialDerivative({ expression: "x^2", variable: "y", allowedSymbols: ["x", "y"], params: {} });
    expect(otherVar).not.toBe(first);
    const otherParams = compilePartialDerivative({
      expression: "a*x",
      variable: "x",
      allowedSymbols: ["a", "x"],
      params: { a: 1 }
    });
    const otherParams2 = compilePartialDerivative({
      expression: "a*x",
      variable: "x",
      allowedSymbols: ["a", "x"],
      params: { a: 2 }
    });
    expect(otherParams2).not.toBe(otherParams);
  });
});
