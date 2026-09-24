import { describe, expect, it } from "vitest";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { useEditorStore } from "@/lib/store/editorStore";
import {
  compileScalarFunctionGradient,
  computeDirectionalDerivative,
  evaluateScalarFunctionGradient
} from "@/lib/math/surfaceDifferential";

function makeSurface(equation: string, orientation?: "x" | "y" | "z"): SurfaceGraphObject {
  return {
    id: "s-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 80,
    appearance: { wireframe: false },
    orientation
  };
}

describe("scalar function gradient (S22 PART 15)", () => {
  it("exposes raw body partials distinct from the level-set normal", () => {
    const compiled = compileScalarFunctionGradient(
      { kind: "explicit", orientation: "z", body: "x^2 + 2*y^2", independentVars: ["x", "y"] },
      {}
    );
    expect(compiled.error).toBeNull();
    expect(compiled.vars).toEqual(["x", "y"]);
    const result = evaluateScalarFunctionGradient(compiled, { x: 1, y: 2, z: 9 }, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Function gradient <2,8> vs level-set normal <-2,-8,1>: related,
    // distinct objects.
    expect(result.gradient.g1).toBeCloseTo(2, 12);
    expect(result.gradient.g2).toBeCloseTo(8, 12);
  });

  it("maps independent variables per orientation", () => {
    const compiled = compileScalarFunctionGradient(
      { kind: "explicit", orientation: "x", body: "y^2 + 3*z", independentVars: ["y", "z"] },
      {}
    );
    expect(compiled.error).toBeNull();
    expect(compiled.vars).toEqual(["y", "z"]);
    const result = evaluateScalarFunctionGradient(compiled, { x: 7, y: 2, z: 1 }, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gradient.g1).toBeCloseTo(4, 12);
    expect(result.gradient.g2).toBeCloseTo(3, 12);
  });

  it("refuses implicit level sets", () => {
    const compiled = compileScalarFunctionGradient({ kind: "implicit", lhs: "x", rhs: "0" }, {});
    expect(compiled.error).toMatch(/explicit/i);
  });
});

describe("directional derivative (S22 PART 14)", () => {
  it("f=x^2+2y^2 at (1,2) along <3,4> gives 7.6", () => {
    const outcome = computeDirectionalDerivative(
      makeSurface("z = x^2 + 2*y^2"),
      { x: 1, y: 2, z: 9 },
      {},
      { u: 3, v: 4 }
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.gradient.g1).toBeCloseTo(2, 12);
    expect(outcome.gradient.g2).toBeCloseTo(8, 12);
    expect(outcome.unitDirection.u).toBeCloseTo(0.6, 12);
    expect(outcome.unitDirection.v).toBeCloseTo(0.8, 12);
    // 2*0.6 + 8*0.8 = 7.6.
    expect(outcome.value).toBeCloseTo(7.6, 10);
  });

  it("normalizes arbitrary nonzero directions", () => {
    const outcome = computeDirectionalDerivative(
      makeSurface("z = x + y"),
      { x: 1, y: 1, z: 2 },
      {},
      { u: 10, v: 0 }
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") {
      return;
    }
    expect(outcome.unitDirection).toEqual({ u: 1, v: 0 });
    expect(outcome.value).toBeCloseTo(1, 12);
  });

  it("rejects zero direction without dividing", () => {
    for (const direction of [{ u: 0, v: 0 }, { u: NaN, v: 1 }]) {
      const outcome = computeDirectionalDerivative(
        makeSurface("z = x^2 + 2*y^2"),
        { x: 1, y: 2, z: 9 },
        {},
        direction
      );
      expect(outcome.status).toBe("zero-direction");
    }
  });

  it("reports invalid source and unavailable derivatives distinctly", () => {
    expect(
      computeDirectionalDerivative(makeSurface("zzz"), { x: 1, y: 2, z: 9 }, {}, { u: 1, v: 0 }).status
    ).toBe("invalid-source");
    expect(
      computeDirectionalDerivative(makeSurface("z = tan(x)"), { x: 0.5, y: 0, z: 0 }, {}, { u: 1, v: 0 })
        .status
    ).toBe("derivative-unavailable");
    expect(
      computeDirectionalDerivative(makeSurface("z = 1/x"), { x: 0, y: 1, z: 0 }, {}, { u: 1, v: 0 }).status
    ).toBe("non-finite");
  });

  it("threads parameters like the surface compilers", () => {
    // The source gate reads ambient editor params (S21 convention); the
    // derivative math takes the explicit snapshot.
    const previous = useEditorStore.getState().parameters;
    try {
      useEditorStore.setState({ parameters: [...previous, { id: "a", value: 3, min: 0, max: 10 }] });
      const outcome = computeDirectionalDerivative(
        makeSurface("z = a*x^2 + y^2"),
        { x: 2, y: 1, z: 13 },
        { a: 3 },
        { u: 1, v: 0 }
      );
      expect(outcome.status).toBe("ok");
      if (outcome.status !== "ok") {
        return;
      }
      expect(outcome.value).toBeCloseTo(12, 10);
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });
});
