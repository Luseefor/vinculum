import { describe, expect, it } from "vitest";
import { compile as compileReference } from "mathjs";
import { compileRustExpression } from "@/lib/math/rustMath";

describe("Rust/WASM numerical execution", () => {
  it.each([
    "sin(x) + cos(y) - tan(x/4)", "asin(x/4) + acos(x/4) + atan(y)",
    "atan2(y,x)", "sqrt(abs(x)) + exp(y/4)", "log(abs(x)+1) + log(8,2)",
    "pow(x,2) + x^3", "floor(x)+ceil(y)+round(x)+round(y,2)",
    "sign(x)+min(x,y,2)+max(x,y,2)", "x % 3", "x > y ? x^2 : y^2", "a*x+b*y",
    "-1 < x <= 2 ? x : y"
  ])("preserves real evaluation for %s", (expression) => {
    const compiled = compileRustExpression(expression);
    expect(compiled.backend).toBe("rust-wasm");
    for (const x of [-2.5, -0.5, 0, 0.5, 2.5]) {
      const scope = { x, y: 0.375, a: 3, b: -2 };
      expect(compiled.evaluate(scope)).toBeCloseTo(Number(compileReference(expression).evaluate(scope)), 10);
    }
  });
  it("preserves domain holes, missing symbols, and invalid AST rejection", () => {
    expect(compileRustExpression("0/0").evaluate({})).toBeNaN();
    expect(compileRustExpression("sqrt(-1)").evaluate({})).toBeNaN();
    expect(compileRustExpression("1/x").evaluate({ x: 0 })).toBe(Infinity);
    expect(compileRustExpression("min(sqrt(-1), 2)").evaluate({})).toBeNaN();
    expect(() => compileRustExpression("x").evaluate({})).toThrow("Undefined symbol x");
    expect(() => compileRustExpression("import(1)")).toThrow();
    expect(() => compileRustExpression("x = 1")).toThrow();
  });
  it("preserves decimal ties and floating point comparison tolerance", () => {
    for (const x of [1.005, -1.005, 2.675, 0.4999999999999]) {
      for (const expression of ["round(x)", "round(x,2)"]) {
        expect(compileRustExpression(expression).evaluate({ x })).toBe(Number(compileReference(expression).evaluate({ x })));
      }
    }
    expect(compileRustExpression("0.1+0.2 == 0.3").evaluate({})).toBe(1);
  });
  it("preserves built-in constants and explicit scope overrides", () => {
    const compiled = compileRustExpression("pi*x+e");
    expect(compiled.evaluate({ x: 2 })).toBe(Math.PI * 2 + Math.E);
    expect(compiled.evaluate({ x: 2, pi: 3, e: 4 })).toBe(10);
  });
  it("samples a grid in Rust with endpoint order and parameter precedence intact", () => {
    const expression = compileRustExpression("a*x+y+z");
    const output = expression.evaluateGrid([
      { symbol: "x", min: -1, max: 1, count: 3 },
      { symbol: "y", min: 0, max: 2, count: 2 },
      { symbol: "z", min: 4, max: 4, count: 1 }
    ], { a: 2, x: 999 });
    expect(Array.from(output)).toEqual([2, 4, 6, 4, 6, 8]);
    expect(() => expression.evaluateGrid([
      { symbol: "x", min: 0, max: 1, count: 32 },
      { symbol: "y", min: 0, max: 1, count: 32 },
      { symbol: "z", min: 0, max: 1, count: 32 }
    ], { a: 2 })).toThrow("sampling budget");
  });
  it("keeps earlier programs valid after WASM memory growth", () => {
    const evaluate = compileRustExpression("x^2+y").evaluate;
    const live = Array.from({ length: 1200 }, () => compileRustExpression("sin(x)+cos(y)+x^2+y^2"));
    expect(evaluate({ x: 3, y: 2 })).toBe(11);
    expect(live[1199]!.evaluate({ x: 0, y: 0 })).toBe(1);
  });
});
