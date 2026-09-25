import { describe, expect, it } from "vitest";
import { compileCurveGeometry } from "@/lib/math/curveGeometry";
import { compileScalarIntegrand } from "@/lib/math/compileScalarIntegrand";

describe("compileCurveGeometry derivatives (S25 PART 5)", () => {
  it("differentiates circle axes through S21 (no finite differences)", () => {
    const geometry = compileCurveGeometry("cos(t)", "sin(t)", "0", {});
    expect(geometry.error).toBeNull();
    const t = 1.2;
    const derivative = geometry.derivative(t);
    expect(derivative[0]).toBeCloseTo(-Math.sin(t), 10);
    expect(derivative[1]).toBeCloseTo(Math.cos(t), 10);
    expect(derivative[2]).toBeCloseTo(0, 12);
    const point = geometry.evaluate(t);
    expect(point[0]).toBeCloseTo(Math.cos(t), 12);
    // Speed of the unit circle is exactly 1.
    expect(geometry.speed(t)).toBeCloseTo(1, 10);
  });

  it("threads parameters without ambient reads", () => {
    const geometry = compileCurveGeometry("a*cos(t)", "a*sin(t)", "0", { a: 2 });
    expect(geometry.error).toBeNull();
    expect(geometry.speed(0.7)).toBeCloseTo(2, 10);
    const other = compileCurveGeometry("a*cos(t)", "a*sin(t)", "0", { a: 3 });
    expect(other.speed(0.7)).toBeCloseTo(3, 10);
  });

  it("reports unsupported derivatives while keeping position valid", () => {
    const geometry = compileCurveGeometry("tan(t)", "t", "0", {});
    expect(geometry.error).not.toBeNull();
    expect(geometry.evaluate(0.5)[0]).toBeCloseTo(Math.tan(0.5), 10);
    expect(geometry.speed(0.5)).toBeNaN();
  });

  it("rejects unsafe axes at the canonical level", () => {
    const geometry = compileCurveGeometry("sin(factorial(t))", "t", "0", {});
    expect(geometry.error).not.toBeNull();
  });
});

describe("compileScalarIntegrand g(x,y,z) (S25 PART 4)", () => {
  it("evaluates physical coordinates with locals winning", () => {
    const g = compileScalarIntegrand("x + 2*y + 3*z", {});
    expect(g.error).toBeNull();
    expect(g.evaluator(1, 2, 3)).toBeCloseTo(14, 12);
  });

  it("rejects equalities, empties, unsafe, and t/u/v locals", () => {
    expect(compileScalarIntegrand("", {}).error).toMatch(/empty/i);
    expect(compileScalarIntegrand("x = 1", {}).error).toMatch(/bare expression/i);
    expect(compileScalarIntegrand("sin(factorial(x))", {}).error).not.toBeNull();
    expect(compileScalarIntegrand("t + x", {}).error).not.toBeNull();
    expect(compileScalarIntegrand("u + x", {}).error).not.toBeNull();
  });

  it("returns NaN (never throws) on domain errors", () => {
    const g = compileScalarIntegrand("1/x", {});
    expect(g.error).toBeNull();
    expect(g.evaluator(0, 0, 0)).toBeNaN();
    expect(g.evaluator(2, 0, 0)).toBeCloseTo(0.5, 12);
  });
});
