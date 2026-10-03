import { parse } from "mathjs";
import { checkFieldExpression, type FieldSolution } from "./fieldSolutions";
import { compilePartialDerivative } from "./compilePartialDerivative";

export function substituteFieldSymbols(expression: string, substitutions: Record<string, string>): string {
  return parse(expression).transform((node) => {
    if (node.type === "SymbolNode") {
      const name = (node as unknown as { name: string }).name;
      if (Object.hasOwn(substitutions, name)) return parse(substitutions[name]!);
    }
    return node;
  }).toString();
}

export function polarVectorCartesianExpressions(radial: string, angular: string): [string, string] {
  // The polar basis is undefined at the origin. Keep the radius denominator
  // unsimplified so the canonical sampler preserves that hole.
  const radius = "sqrt(x^2+y^2)";
  const ar = substituteFieldSymbols(radial, { r: radius, theta: "atan2(y,x)" });
  const at = substituteFieldSymbols(angular, { r: radius, theta: "atan2(y,x)" });
  return [`((${ar})*x-(${at})*y)/(${radius})`, `((${ar})*y+(${at})*x)/(${radius})`];
}

export function solvePolarCurve(radius: string, params: Record<string, number>): FieldSolution {
  const error = checkFieldExpression(radius, ["theta"], params);
  const derivative = error ? null : compilePartialDerivative({ expression: radius, variable: "theta", allowedSymbols: ["theta", ...Object.keys(params)], params });
  return { definition: `r(θ) = ${radius}`, error, notes: ["θ is in radians. Negative radius values are permitted for polar curves."], answers: error ? [] : [
    { label: "Cartesian curve", expressions: [`(${radius})*cos(theta)`, `(${radius})*sin(theta)`], formula: "x = r cos θ; y = r sin θ", steps: ["Substitute the radius expression into x(θ) and y(θ)."], errors: [], basis: "x, y" },
    { label: "Radial derivative", expressions: [derivative?.expression ?? null], formula: "dr/dθ", steps: [`Differentiate r(θ): ${derivative?.expression ?? "unavailable"}`], errors: derivative?.error ? [derivative.error] : [] }
  ] };
}
