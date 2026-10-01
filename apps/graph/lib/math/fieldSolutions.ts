import { parse, simplify } from "mathjs";
import { compileRustExpression as compile } from "./rustMath";
import { compileRepeatedPartialDerivative } from "./compilePartialDerivative";
import { validateExpressionSafety } from "./expressionSafety";

export interface SymbolicAnswer {
  label: string;
  expressions: (string | null)[];
  formula: string;
  steps: string[];
  errors: string[];
  basis?: string;
  conclusion?: string;
}
export interface FieldSolution {
  definition: string;
  answers: SymbolicAnswer[];
  notes: string[];
  error: string | null;
}
export interface FieldProblem {
  kind: "scalar" | "vector";
  coordinates: "cartesian" | "polar";
  components: string[];
  variables: string[];
  params: Record<string, number>;
}

export function checkFieldExpression(expression: string, variables: string[], params: Record<string, number>): string | null {
  if (!expression.trim()) return "Enter an expression.";
  const safety = validateExpressionSafety(expression, {
    operation: "field-solution", expressionLabel: "Field definition",
    allowedSymbols: [...variables, ...Object.keys(params).filter((key) => !["x", "y", "z", "r", "theta", "t", "u", "v", "i"].includes(key))],
    strictSymbols: true
  });
  return safety.ok ? null : safety.violation.message;
}

export function simplifyFieldExpression(expression: string, variables: string[], params: Record<string, number>): string | null {
  if (checkFieldExpression(expression, variables, params)) return null;
  try {
    const result = simplify(parse(expression)).toString();
    return checkFieldExpression(result, variables, params) ? null : result;
  } catch { return null; }
}

export function solveFieldProblem(problem: FieldProblem): FieldSolution {
  const { kind, coordinates, components, variables, params } = problem;
  const polar = coordinates === "polar";
  const required = kind === "scalar" ? 1 : variables.length;
  const error = variables.length < 2 || variables.length > 3 || (polar && variables.join(",") !== "r,theta")
    ? "Use two or three Cartesian variables, or r and theta for polar coordinates."
    : components.length !== required ? `Enter ${required} component expressions.`
    : components.map((expression) => checkFieldExpression(expression, variables, params)).find(Boolean) ?? null;
  const definition = kind === "scalar" ? `g = ${components[0] ?? ""}` : `F = <${components.join(", ")}>${polar ? " in (eᵣ, eθ)" : ""}`;
  if (error) return { definition, answers: [], notes: [], error };
  const notes = ["Answers apply where the original field and the required derivatives are defined. Simplification does not remove source singularities."];
  if (polar) notes.push("Polar components use the orthonormal basis (eᵣ, eθ). θ is in radians; formulas require r > 0.");
  const d = (expression: string | null, ...axes: string[]): string | null => {
    if (expression === null) return null;
    const result = compileRepeatedPartialDerivative({ expression, variable: axes[0]!, allowedSymbols: [...variables, ...Object.keys(params)], params }, axes);
    return result.error ? null : result.expression ?? null;
  };
  const combine = (values: (string | null)[], make: (values: string[]) => string): string | null =>
    values.some((value) => value === null) ? null : simplifyFieldExpression(make(values as string[]), variables, params);
  const sum = (values: (string | null)[]) => combine(values, (terms) => terms.map((term) => `(${term})`).join(" + "));
  const minus = (a: string | null, b: string | null) => combine([a, b], ([left, right]) => `(${left}) - (${right})`);
  const scalarLap = (expression: string): string | null => polar
    ? combine([d(expression, "r", "r"), d(expression, "r"), d(expression, "theta", "theta")], ([rr, r, tt]) => `(${rr}) + (${r})/r + (${tt})/r^2`)
    : sum(variables.map((axis) => d(expression, axis, axis)));
  const answer = (label: string, expressions: (string | null)[], formula: string, steps: string[], basis?: string): SymbolicAnswer => ({
    label, expressions, formula, steps,
    errors: expressions.flatMap((expression, index) => expression === null ? [`Component ${index + 1}: symbolic derivative or simplification unavailable for this expression.`] : []), basis
  });
  const normalize = (values: (string | null)[]) => values.map((value) => combine([...values, value], (terms) => `(${terms[terms.length - 1]})/sqrt(${terms.slice(0, -1).map((term) => `(${term})^2`).join(" + ")})`));
  const answers: SymbolicAnswer[] = [];
  if (kind === "scalar") {
    const g = components[0]!;
    const gradient = variables.map((axis) => d(g, axis));
    if (polar) gradient[1] = combine([gradient[1]!], ([theta]) => `(${theta})/r`);
    answers.push(answer("Gradient", gradient, polar ? "∇g = gᵣ eᵣ + (gθ/r) eθ" : `∇g = <${variables.map((axis) => `∂g/∂${axis}`).join(", ")}>`, variables.map((axis) => `∂g/∂${axis} = ${d(g, axis) ?? "unavailable"}`), polar ? "eᵣ, eθ" : variables.join(", ")));
    answers.push(answer("Scalar Laplacian", [scalarLap(g)], polar ? "Δg = gᵣᵣ + gᵣ/r + gθθ/r²" : `Δg = ${variables.map((axis) => `∂²g/∂${axis}²`).join(" + ")}`, variables.map((axis) => `∂²g/∂${axis}² = ${d(g, axis, axis) ?? "unavailable"}`)));
    answers.push(answer("Direction of increase", normalize(gradient), "Unit direction = ∇g / |∇g|", ["Evaluate the gradient at a point, then divide by its magnitude. At a zero gradient the direction is undefined."], polar ? "eᵣ, eθ" : variables.join(", ")));
  } else {
    const [p, q, r] = components as [string, string, string | undefined];
    const jac = components.map((component) => variables.map((axis) => d(component, axis)));
    const steps = components.flatMap((component, i) => variables.map((axis, j) => `∂(${component})/∂${axis} = ${jac[i]![j] ?? "unavailable"}`));
    const divergence = polar
      ? combine([jac[0]![0]!, jac[1]![1]!], ([pr, qt]) => `(${pr}) + (${p})/r + (${qt})/r`)
      : sum(variables.map((_, i) => jac[i]![i]!));
    answers.push(answer("Divergence", [divergence], polar ? "div F = ∂Fᵣ/∂r + Fᵣ/r + (∂Fθ/∂θ)/r" : `div F = ${variables.map((axis, i) => `∂${["P", "Q", "R"][i]}/∂${axis}`).join(" + ")}`, steps));
    const curl = polar
      ? [combine([jac[1]![0]!, jac[0]![1]!], ([qr, pt]) => `(${qr}) + (${q})/r - (${pt})/r`)]
      : variables.length === 2 ? [minus(jac[1]![0]!, jac[0]![1]!)]
      : [minus(jac[2]![1]!, jac[1]![2]!), minus(jac[0]![2]!, jac[2]![0]!), minus(jac[1]![0]!, jac[0]![1]!)];
    answers.push(answer(variables.length === 2 ? "Scalar curl" : "Curl", curl, polar ? "curl F = ∂Fθ/∂r + Fθ/r − (∂Fᵣ/∂θ)/r" : r === undefined ? "curl F = Qₓ − Pᵧ" : "curl F = <Rᵧ − Qz, Pz − Rₓ, Qₓ − Pᵧ>", steps, variables.length === 3 ? variables.join(", ") : undefined));
    const lap = polar ? [
      combine([scalarLap(p), jac[1]![1]!], ([lp, qt]) => `(${lp}) - (${p})/r^2 - 2*(${qt})/r^2`),
      combine([scalarLap(q), jac[0]![1]!], ([lq, pt]) => `(${lq}) - (${q})/r^2 + 2*(${pt})/r^2`)
    ] : components.map(scalarLap);
    answers.push(answer("Vector Laplacian", lap, polar ? "ΔF = (ΔFᵣ − Fᵣ/r² − 2Fθ,θ/r²)eᵣ + (ΔFθ − Fθ/r² + 2Fᵣ,θ/r²)eθ" : "ΔF = <ΔP, ΔQ, ΔR> (omit R in 2D)", components.flatMap((component) => variables.map((axis) => `∂²(${component})/∂${axis}² = ${d(component, axis, axis) ?? "unavailable"}`)), polar ? "eᵣ, eθ" : variables.join(", ")));
    answers.push(answer("Field direction", normalize(components), "Unit direction = F / |F|", ["Evaluate the components at a point and normalize. A zero field has no direction."], polar ? "eᵣ, eθ" : variables.join(", ")));
  }
  for (const entry of answers) {
    if (entry.label !== "Field direction" && entry.label !== "Direction of increase") continue;
    const source = entry.label === "Field direction" ? components : answers.find((candidate) => candidate.label === "Gradient")?.expressions ?? [];
    if (source.length > 0 && source.every((expression) => expression !== null && simplifyFieldExpression(expression, variables, params) === "0")) {
      entry.conclusion = "Undefined (zero field or gradient)";
      entry.errors = [];
    }
  }
  return { definition, answers, notes, error: null };
}

export function evaluateSymbolicAnswer(answer: SymbolicAnswer, scope: Record<string, number>): (number | null)[] {
  return answer.expressions.map((expression) => {
    if (expression === null) return null;
    try {
      const value: unknown = compile(expression).evaluate(scope);
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    } catch { return null; }
  });
}
