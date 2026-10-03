import { describe, expect, it } from "vitest";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";

describe("compileVectorFieldExpressions (S20 Slice 2)", () => {
  it("compiles 2D radial: F(1,2) = <1,2>", () => {
    const compiled = compileVectorFieldExpressions("2d", "x", "y", "", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate3D).toBeNull();
    expect(compiled.evaluate2D?.(1, 2)).toEqual([1, 2]);
  });

  it("compiles 2D rotational: F(1,2) = <-2,1>", () => {
    const compiled = compileVectorFieldExpressions("2d", "-y", "x", "", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate2D?.(1, 2)).toEqual([-2, 1]);
  });

  it("compiles 3D radial: F(1,2,3) = <1,2,3>", () => {
    const compiled = compileVectorFieldExpressions("3d", "x", "y", "z", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate2D).toBeNull();
    expect(compiled.evaluate3D?.(1, 2, 3)).toEqual([1, 2, 3]);
  });

  it("compiles 3D rotational: F(1,2,3) = <-2,1,0>", () => {
    const compiled = compileVectorFieldExpressions("3d", "-y", "x", "0", {});
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate3D?.(1, 2, 3)).toEqual([-2, 1, 0]);
  });

  it("resolves editor parameters: <a*x, y, z> with a=2", () => {
    const compiled = compileVectorFieldExpressions("3d", "a*x", "y", "z", { a: 2 });
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate3D?.(1, 2, 3)).toEqual([2, 2, 3]);
  });

  it("locals override same-named parameters", () => {
    const compiled = compileVectorFieldExpressions("2d", "x", "y", "", { x: 99, y: -99 });
    expect(compiled.error).toBeNull();
    expect(compiled.evaluate2D?.(1, 2)).toEqual([1, 2]);
  });

  it("rejects empty components", () => {
    expect(compileVectorFieldExpressions("2d", "", "y", "", {}).error).toMatch(/P\(x,y\) cannot be empty/);
    expect(compileVectorFieldExpressions("3d", "x", "y", "", {}).error).toMatch(/R\(x,y,z\) cannot be empty/);
  });

  it("rejects nested unsafe through S11", () => {
    const compiled = compileVectorFieldExpressions("2d", "sin(factorial(x))", "y", "", {});
    expect(compiled.error).toMatch(/Unsupported function: factorial/);
  });

  it("rejects assignments and unknown symbols", () => {
    expect(compileVectorFieldExpressions("2d", "x = 1", "y", "", {}).error).not.toBeNull();
    const unknown = compileVectorFieldExpressions("2d", "zzz", "y", "", {});
    expect(unknown.error).toMatch(/Unsupported symbol: zzz/);
  });

  it("rejects reserved locals u/v/t in both dimensions, and z in 2D", () => {
    expect(compileVectorFieldExpressions("2d", "t", "y", "", {}).error).toMatch(/'t' is not supported/);
    expect(compileVectorFieldExpressions("3d", "u", "y", "z", {}).error).toMatch(/'u' is not supported/);
    expect(compileVectorFieldExpressions("3d", "x", "v", "z", {}).error).toMatch(/'v' is not supported/);
    expect(compileVectorFieldExpressions("2d", "x", "z", "", {}).error).toMatch(/'z' is not supported/);
    // 3D legitimately uses z.
    expect(compileVectorFieldExpressions("3d", "x", "y", "z", {}).error).toBeNull();
  });

  it("rejects reserved locals inside function arguments", () => {
    expect(compileVectorFieldExpressions("2d", "sin(t)", "y", "", {}).error).toMatch(/'t' is not supported/);
  });

  it("evaluates to NaN (never throws) on domain failure", () => {
    const compiled = compileVectorFieldExpressions("2d", "1/x", "y", "", {});
    expect(compiled.error).toBeNull();
    const [px] = compiled.evaluate2D?.(0, 1) ?? [0];
    expect(Number.isNaN(px)).toBe(true);
    expect(() => compiled.evaluate2D?.(0, 1)).not.toThrow();
  });

  it("caches identical compilations", () => {
    const first = compileVectorFieldExpressions("2d", "x", "y", "", { a: 1 });
    const second = compileVectorFieldExpressions("2d", "x", "y", "", { a: 1 });
    expect(second).toBe(first);
    const otherParams = compileVectorFieldExpressions("2d", "x", "y", "", { a: 2 });
    expect(otherParams).not.toBe(first);
  });

  it("separates cache keys across expression boundaries (S20-R1)", () => {
    // Undelimited concatenation collides p="1+2",q="3" with p="1",q="+23"
    // ("2d1+23" both ways) and would serve a stale wrong-field evaluator.
    const first = compileVectorFieldExpressions("2d", "1+2", "3", "", {});
    const second = compileVectorFieldExpressions("2d", "1", "+23", "", {});
    expect(second).not.toBe(first);
    expect(first.evaluate2D?.(0, 0)).toEqual([3, 3]);
    expect(second.evaluate2D?.(0, 0)).toEqual([1, 23]);
  });
});
