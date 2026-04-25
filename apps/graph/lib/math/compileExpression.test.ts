import { describe, expect, it } from "vitest";
import { compileSurfaceExpression, getEffectiveSurfaceOrientation } from "./compileExpression";

describe("getEffectiveSurfaceOrientation", () => {
  it("uses the leading x=, y=, or z= axis as the dependent variable", () => {
    expect(getEffectiveSurfaceOrientation("x = 2", "z")).toEqual({
      body: "2",
      effectiveOrientation: "x"
    });
    expect(getEffectiveSurfaceOrientation("Y=3", "x")).toEqual({
      body: "3",
      effectiveOrientation: "y"
    });
    expect(getEffectiveSurfaceOrientation("z= x^2 + y^2", "x")).toEqual({
      body: "x^2 + y^2",
      effectiveOrientation: "z"
    });
  });

  it("falls back to UI orientation when there is no leading x/y/z assignment", () => {
    expect(getEffectiveSurfaceOrientation("x^2 + y^2", "z")).toEqual({
      body: "x^2 + y^2",
      effectiveOrientation: "z"
    });
  });

  it("still strips f(x,y)= for implicit surfaces", () => {
    expect(getEffectiveSurfaceOrientation("f(x,y) = x + 1", "z")).toEqual({
      body: "x + 1",
      effectiveOrientation: "z"
    });
  });
});

describe("compileSurfaceExpression", () => {
  it("compiles x = const as a vertical plane (x orientation), not z = const", () => {
    const { error, effectiveOrientation, evaluator } = compileSurfaceExpression("x = 2", "z");
    expect(error).toBeNull();
    expect(effectiveOrientation).toBe("x");
    expect(evaluator(0, 0)).toBe(2);
    expect(evaluator(5, -3)).toBe(2);
  });
});
