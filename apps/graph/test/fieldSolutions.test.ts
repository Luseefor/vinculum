import { describe, expect, it } from "vitest";
import { evaluateSymbolicAnswer, solveFieldProblem, type FieldSolution } from "@/lib/math/fieldSolutions";
import { solveComplexField, solveHarmonicConjugate, splitComplexExpression } from "@/lib/math/complexFieldAnalysis";

const answer = (solution: FieldSolution, label: string) => {
  expect(solution.error).toBeNull();
  const result = solution.answers.find((entry) => entry.label === label);
  expect(result).toBeDefined();
  return result!;
};
const vector = (components: string[], polar = false) => solveFieldProblem({ kind: "vector", coordinates: polar ? "polar" : "cartesian", variables: polar ? ["r", "theta"] : components.length === 2 ? ["x", "y"] : ["x", "y", "z"], components, params: {} });

describe("automatic field solutions", () => {
  it("solves curl and divergence symbolically without an analysis point", () => {
    const solved = vector(["-y", "x", "0"]);
    expect(answer(solved, "Curl").expressions).toEqual(["0", "0", "2"]);
    expect(answer(solved, "Divergence").expressions).toEqual(["0"]);
    expect(answer(solved, "Curl").steps).toContain("∂(x)/∂x = 1");
  });
  it("returns nonconstant curl expressions and Cartesian vector Laplacians", () => {
    const solved = vector(["y^2", "z^2", "x^2"]);
    expect(evaluateSymbolicAnswer(answer(solved, "Curl"), { x: 2, y: 3, z: 4 })).toEqual([-8, -4, -6]);
    expect(answer(solved, "Vector Laplacian").expressions).toEqual(["2", "2", "2"]);
  });
  it("computes normalized direction and leaves zero directions undefined", () => {
    const solved = vector(["x", "y"]);
    expect(evaluateSymbolicAnswer(answer(solved, "Field direction"), { x: 3, y: 4 })).toEqual([0.6, 0.8]);
    expect(evaluateSymbolicAnswer(answer(solved, "Field direction"), { x: 0, y: 0 })).toEqual([null, null]);
  });
  it("includes polar basis coupling in the vector Laplacian", () => {
    const radial = vector(["r", "0"], true);
    expect(answer(radial, "Divergence").expressions).toEqual(["2"]);
    expect(answer(radial, "Scalar curl").expressions).toEqual(["0"]);
    expect(answer(radial, "Vector Laplacian").expressions).toEqual(["0", "0"]);
    const swirl = vector(["0", "r"], true);
    expect(answer(swirl, "Scalar curl").expressions).toEqual(["2"]);
    expect(answer(swirl, "Vector Laplacian").expressions).toEqual(["0", "0"]);
  });
  it("supports polar scalar gradients and Laplacians", () => {
    const solved = solveFieldProblem({ kind: "scalar", coordinates: "polar", components: ["r^2"], variables: ["r", "theta"], params: {} });
    expect(evaluateSymbolicAnswer(answer(solved, "Gradient"), { r: 3, theta: 1 })).toEqual([6, 0]);
    expect(answer(solved, "Scalar Laplacian").expressions).toEqual(["4"]);
  });
  it("fails closed on unsupported symbols, unsafe inputs, and unsupported derivatives", () => {
    expect(vector(["factorial(x)", "y"]).error).toMatch(/Unsupported function/);
    expect(vector(["z", "y"]).error).toMatch(/Unsupported symbol/);
    expect(vector(["x=2", "y"]).error).not.toBeNull();
    expect(vector(["x".repeat(2050), "y"]).error).toMatch(/too long/);
    const solved = vector(["tan(x)", "y"]);
    expect(answer(solved, "Divergence").expressions).toEqual([null]);
    expect(answer(solved, "Divergence").errors.length).toBeGreaterThan(0);
  });
  it("reads updated parameter values at evaluation time", () => {
    const solved = solveFieldProblem({ kind: "vector", coordinates: "cartesian", components: ["a*x^2", "y^2"], variables: ["x", "y"], params: { a: 2 } });
    expect(evaluateSymbolicAnswer(answer(solved, "Vector Laplacian"), { a: 3, x: 1, y: 1 })).toEqual([6, 2]);
  });
});

describe("complex field analysis", () => {
  it("expands complex polynomials, reciprocals, and exponentials", () => {
    for (const expression of ["z^2", "1/z", "exp(z)", "sin(z)", "cos(z)", "conj(z)"]) {
      const pair = splitComplexExpression(expression, {});
      expect("error" in pair).toBe(false);
    }
    expect(splitComplexExpression("z^2", {})).toEqual({ real: "x ^ 2 - y ^ 2", imaginary: "2 * x * y" });
  });
  it("rejects unsafe and unsupported complex expansions", () => {
    expect(splitComplexExpression("import(z)", {})).toHaveProperty("error");
    expect(splitComplexExpression("sqrt(z)", {})).toHaveProperty("error");
    expect(splitComplexExpression("z^100", {})).toHaveProperty("error");
    expect(splitComplexExpression("x + i", {})).toHaveProperty("error");
  });
  it("verifies CR while retaining the (u,v) divergence/curl convention", () => {
    const solved = solveComplexField("x^2-y^2", "2*x*y", {});
    expect(answer(solved, "Cauchy–Riemann residuals").expressions).toEqual(["0", "0"]);
    expect(evaluateSymbolicAnswer(answer(solved, "Divergence"), { x: 2, y: 3 })).toEqual([8]);
    expect(evaluateSymbolicAnswer(answer(solved, "Scalar curl"), { x: 2, y: 3 })).toEqual([12]);
    expect(answer(solved, "Complex Laplacian").expressions).toEqual(["0", "0"]);
    expect(evaluateSymbolicAnswer(answer(solved, "Complex derivative"), { x: 2, y: 3 })).toEqual([4, 6]);
  });
  it("does not confuse harmonic components with analyticity", () => {
    const solved = solveComplexField("x", "-y", {});
    expect(answer(solved, "Complex Laplacian").expressions).toEqual(["0", "0"]);
    expect(answer(solved, "Cauchy–Riemann residuals").expressions).toEqual(["2", "0"]);
    expect(solved.answers.find((entry) => entry.label === "Complex derivative")).toBeUndefined();
  });
  it("solves linear CR residual systems and rejects constant contradictions", () => {
    const isolated = solveComplexField("x^2+y^2", "0", {});
    expect(answer(isolated, "Cauchy–Riemann solutions").expressions).toEqual(["0", "0"]);
    const conjugate = solveComplexField("x", "-y", {});
    expect(answer(conjugate, "Cauchy–Riemann solutions").conclusion).toMatch(/No solutions/);
  });
  it("preserves cancelled complex source singularities in plots", () => {
    const pair = splitComplexExpression("z/z", {});
    expect("error" in pair).toBe(false);
    if ("error" in pair) return;
    const source = vector([pair.real, pair.imaginary]);
    // Symbolic answers are restricted to the original source domain.
    expect(source.notes.join(" ")).toMatch(/singularities/);
  });
  it("constructs and verifies a polynomial harmonic conjugate", () => {
    const solved = solveHarmonicConjugate("x^2-y^2", {});
    expect(evaluateSymbolicAnswer(answer(solved, "Harmonic conjugate"), { x: 2, y: 3 })).toEqual([12]);
    expect(answer(solved, "Cauchy–Riemann residuals").expressions).toEqual(["0", "0"]);
    expect(solved.notes.join(" ")).toMatch(/constant C/);
  });
  it("rejects nonharmonic inputs and unsupported conjugate construction", () => {
    expect(solveHarmonicConjugate("x^2+y^2", {}).error).toMatch(/not identically harmonic/);
    expect(solveHarmonicConjugate("exp(x)*cos(y)", {}).error).toMatch(/polynomials/);
  });
});
