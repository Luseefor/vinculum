import { parse, type MathNode } from "mathjs";
import { compilePartialDerivative } from "./compilePartialDerivative";
import { substituteFieldSymbols } from "./polarFieldExpressions";
import { validateExpressionSafety } from "./expressionSafety";
import { simplifyFieldExpression, solveFieldProblem, type FieldSolution, type SymbolicAnswer } from "./fieldSolutions";

type Pair = { real: string; imaginary: string };
type Ast = MathNode & { name?: string; value?: unknown; op?: string; args?: MathNode[]; content?: MathNode; fn?: MathNode };

/** Converts a bounded complex AST into real component expressions; never evaluates user code. */
export function splitComplexExpression(expression: string, params: Record<string, number>): Pair | { error: string } {
  if (!expression.trim()) return { error: "Enter a complex expression." };
  const safety = validateExpressionSafety(expression, {
    operation: "complex-field", expressionLabel: "Complex function", strictSymbols: true,
    allowedSymbols: ["z", "i", ...Object.keys(params).filter((key) => !["z", "i", "x", "y", "t", "u", "v", "r", "theta"].includes(key))], additionalFunctions: ["conj"]
  });
  if (!safety.ok) return { error: safety.violation.message };
  const exclusions: string[] = [];
  const tidy = (pair: Pair): Pair => {
    const real = simplifyFieldExpression(pair.real, ["x", "y"], params);
    const imaginary = simplifyFieldExpression(pair.imaginary, ["x", "y"], params);
    if (real === null || imaginary === null) throw new Error("Complex expression expansion exceeds the supported expression limits.");
    return { real, imaginary };
  };
  const mul = (a: Pair, b: Pair) => tidy({ real: `(${a.real})*(${b.real})-(${a.imaginary})*(${b.imaginary})`, imaginary: `(${a.real})*(${b.imaginary})+(${a.imaginary})*(${b.real})` });
  const walk = (node: MathNode, depth: number): Pair => {
    if (depth > 32) throw new Error("Complex expression is too deeply nested.");
    const ast = node as Ast;
    if (ast.type === "ParenthesisNode" && ast.content) return walk(ast.content, depth + 1);
    if (ast.type === "ConstantNode" && typeof ast.value === "number") return { real: String(ast.value), imaginary: "0" };
    if (ast.type === "SymbolNode") {
      if (ast.name === "z") return { real: "x", imaginary: "y" };
      if (ast.name === "i") return { real: "0", imaginary: "1" };
      return { real: ast.name!, imaginary: "0" };
    }
    const args = ast.args ?? [];
    if (ast.type === "OperatorNode") {
      const a = walk(args[0]!, depth + 1);
      if (args.length === 1 && ["+", "-"].includes(ast.op!)) return ast.op === "+" ? a : tidy({ real: `-(${a.real})`, imaginary: `-(${a.imaginary})` });
      if (ast.op === "^") {
        const exponentNode = args[1] as Ast;
        const exponent = Number(exponentNode.toString());
        if (!Number.isInteger(exponent) || exponent < 0 || exponent > 12) throw new Error("Complex powers must be integers from 0 to 12. Use division for reciprocals.");
        let result = { real: "1", imaginary: "0" };
        for (let i = 0; i < exponent; i++) result = mul(result, a);
        return result;
      }
      const b = walk(args[1]!, depth + 1);
      if (ast.op === "+" || ast.op === "-") return tidy({ real: `(${a.real}) ${ast.op} (${b.real})`, imaginary: `(${a.imaginary}) ${ast.op} (${b.imaginary})` });
      if (ast.op === "*") return mul(a, b);
      if (ast.op === "/") {
        const numerator = mul(a, { real: b.real, imaginary: `-(${b.imaginary})` });
        const denominator = `(${b.real})^2+(${b.imaginary})^2`;
        exclusions.push(denominator);
        return tidy({ real: `(${numerator.real})/(${denominator})`, imaginary: `(${numerator.imaginary})/(${denominator})` });
      }
    }
    if (ast.type === "FunctionNode" && args.length === 1) {
      const a = walk(args[0]!, depth + 1);
      const name = (ast.fn as Ast)?.name;
      if (name === "conj") return tidy({ real: a.real, imaginary: `-(${a.imaginary})` });
      if (name === "exp") return tidy({ real: `exp(${a.real})*cos(${a.imaginary})`, imaginary: `exp(${a.real})*sin(${a.imaginary})` });
      const cosh = `(exp(${a.imaginary})+exp(-(${a.imaginary})))/2`;
      const sinh = `(exp(${a.imaginary})-exp(-(${a.imaginary})))/2`;
      if (name === "sin") return tidy({ real: `sin(${a.real})*(${cosh})`, imaginary: `cos(${a.real})*(${sinh})` });
      if (name === "cos") return tidy({ real: `cos(${a.real})*(${cosh})`, imaginary: `-sin(${a.real})*(${sinh})` });
      if (a.imaginary === "0") return tidy({ real: `${name}(${a.real})`, imaginary: "0" });
    }
    throw new Error("Supported complex expressions use arithmetic, integer powers, exp, sin, cos, and conj. Use u(x,y), v(x,y) for other functions.");
  };
  try {
    const result = tidy(walk(parse(expression), 0));
    for (const denominator of exclusions) {
      result.real = `(${result.real})*((${denominator})/(${denominator}))`;
      result.imaginary = `(${result.imaginary})*((${denominator})/(${denominator}))`;
    }
    if (result.real.length > 2048 || result.imaginary.length > 2048) return { error: "Complex expansion exceeds the supported expression limits." };
    return result;
  }
  catch (error) { return { error: error instanceof Error ? error.message : "Complex expression cannot be expanded." }; }
}

export function solveComplexField(real: string, imaginary: string, params: Record<string, number>): FieldSolution {
  const source = solveFieldProblem({ kind: "vector", coordinates: "cartesian", components: [real, imaginary], variables: ["x", "y"], params });
  if (source.error) return source;
  const scalarU = solveFieldProblem({ kind: "scalar", coordinates: "cartesian", components: [real], variables: ["x", "y"], params });
  const scalarV = solveFieldProblem({ kind: "scalar", coordinates: "cartesian", components: [imaginary], variables: ["x", "y"], params });
  const ux = scalarU.answers[0]!.expressions[0];
  const uy = scalarU.answers[0]!.expressions[1];
  const vx = scalarV.answers[0]!.expressions[0];
  const vy = scalarV.answers[0]!.expressions[1];
  const cr = [ux !== null && vy !== null ? simplifyFieldExpression(`(${ux})-(${vy})`, ["x", "y"], params) : null,
    uy !== null && vx !== null ? simplifyFieldExpression(`(${uy})+(${vx})`, ["x", "y"], params) : null];
  const zero = cr.every((expression) => expression === "0");
  const crAnswer: SymbolicAnswer = {
    label: "Cauchy–Riemann residuals", expressions: cr, formula: "uₓ − vᵧ = 0; uᵧ + vₓ = 0",
    steps: [`uₓ = ${ux ?? "unavailable"}`, `uᵧ = ${uy ?? "unavailable"}`, `vₓ = ${vx ?? "unavailable"}`, `vᵧ = ${vy ?? "unavailable"}`,
      zero ? "Both residuals simplify identically to zero. The Cauchy–Riemann equations hold where these component functions are continuously differentiable."
      : "Solve both residual equations simultaneously. Equality at one point alone does not establish analyticity on a region."],
    errors: cr.some((expression) => expression === null) ? ["Required partial derivatives are unavailable."] : []
  };
  const answers: SymbolicAnswer[] = [
    { ...scalarU.answers[0]!, label: "Gradient of real part" },
    { ...scalarV.answers[0]!, label: "Gradient of imaginary part" },
    ...source.answers.filter((answer) => !answer.label.includes("Laplacian")),
    { label: "Complex Laplacian", expressions: [scalarU.answers[1]!.expressions[0]!, scalarV.answers[1]!.expressions[0]!], formula: "Δf = Δu + i Δv", steps: [...scalarU.answers[1]!.steps, ...scalarV.answers[1]!.steps], errors: [...scalarU.answers[1]!.errors, ...scalarV.answers[1]!.errors], basis: "real, imaginary" },
    crAnswer, solveCRLocations(cr, params)
  ];
  if (zero) answers.push({ label: "Complex derivative", expressions: [ux!, vx!], formula: "f′(z) = uₓ + i vₓ", steps: ["This derivative applies on regions where the component functions are continuously differentiable and both Cauchy–Riemann equations hold."], errors: [], basis: "real, imaginary" });
  return { ...source, definition: `f = (${real}) + i (${imaginary})`, answers,
    notes: [...source.notes, "Divergence and curl refer to the associated real vector field F = (u,v). Harmonic components alone do not prove analyticity."] };
}

function polynomialIntegral(expression: string, variable: "x" | "y", params: Record<string, number>): string | null {
  let current = expression;
  let factorial = 1;
  const terms: string[] = [];
  for (let order = 0; order <= 8; order++) {
    const coefficient = parse(current).transform((node) => (node as Ast).type === "SymbolNode" && (node as Ast).name === variable ? parse("0") : node).toString();
    terms.push(`(${coefficient})*${variable}^${order + 1}/${factorial * (order + 1)}`);
    const next = compilePartialDerivative({ expression: current, variable, allowedSymbols: ["x", "y", ...Object.keys(params)], params });
    if (next.error || !next.expression) return null;
    current = simplifyFieldExpression(next.expression, ["x", "y"], params) ?? "";
    if (current === "0") return simplifyFieldExpression(terms.join(" + "), ["x", "y"], params);
    if (!current) return null;
    factorial *= order + 1;
  }
  return null;
}

/** Exact symbolic polynomial construction, followed by verification of both CR equations. */
export function solveHarmonicConjugate(real: string, params: Record<string, number>): FieldSolution {
  const scalar = solveFieldProblem({ kind: "scalar", coordinates: "cartesian", components: [real], variables: ["x", "y"], params });
  if (scalar.error) return scalar;
  const laplacian = scalar.answers[1]!.expressions[0];
  if (laplacian !== "0") return { ...scalar, error: laplacian === null ? "Harmonicity could not be verified." : "The real part is not identically harmonic; a harmonic conjugate on an open region cannot be constructed." };
  const [ux, uy] = scalar.answers[0]!.expressions;
  if (ux === null || uy === null) return { ...scalar, error: "Required derivatives are unavailable." };
  const initial = polynomialIntegral(ux!, "y", params);
  if (initial === null) return { ...scalar, error: "Conjugate construction supports polynomials of degree at most 8 in each integration variable. Enter u and v to check other functions." };
  const initialX = compilePartialDerivative({ expression: initial, variable: "x", allowedSymbols: ["x", "y", ...Object.keys(params)], params });
  if (!initialX.expression) return { ...scalar, error: "Conjugate derivative is unavailable." };
  const correction = simplifyFieldExpression(`-(${uy})-(${initialX.expression})`, ["x", "y"], params);
  const integral = correction === null ? null : polynomialIntegral(correction, "x", params);
  const imaginary = integral === null ? null : simplifyFieldExpression(`(${initial})+(${integral})`, ["x", "y"], params);
  if (imaginary === null) return { ...scalar, error: "Conjugate construction is unavailable for this expression." };
  const verified = solveComplexField(real, imaginary, params);
  if (!verified.answers.find((answer) => answer.label === "Cauchy–Riemann residuals")?.expressions.every((expression) => expression === "0")) return { ...scalar, error: "The generated conjugate did not pass symbolic verification." };
  verified.answers.unshift({ label: "Harmonic conjugate", expressions: [imaginary], formula: "vᵧ = uₓ; vₓ = −uᵧ", steps: [`Δu = ${laplacian}`, `Integrate uₓ with respect to y: v₀ = ${initial}`, `Correction derivative c′(x) = ${correction}`, `Integrate c′(x): c(x) = ${integral}`, `v = ${imaginary} + C, where C is any real constant.`, "Verify vᵧ − uₓ = 0 and vₓ + uᵧ = 0."], errors: [] });
  verified.notes.push("The harmonic conjugate is determined up to an additive real constant C.");
  return verified;
}

function solveCRLocations(residuals: (string | null)[], params: Record<string, number>): SymbolicAnswer {
  const base: SymbolicAnswer = { label: "Cauchy–Riemann solutions", expressions: [], formula: "Solve uₓ − vᵧ = 0 and uᵧ + vₓ = 0 together", steps: [], errors: [] };
  if (residuals.some((value) => value === null)) return { ...base, conclusion: "Unavailable: required derivatives are unsupported." };
  const [first, second] = residuals as [string, string];
  if (first === "0" && second === "0") return { ...base, conclusion: "Both equations hold identically on the source's continuously differentiable domain.", steps: ["Both residual expressions simplify to zero.", "Restrict the result to points where the original components and their partial derivatives are defined and continuous."] };
  const simplify = (expression: string) => simplifyFieldExpression(expression, ["x", "y"], params);
  const derivative = (expression: string, variable: string) => {
    const value = compilePartialDerivative({ expression, variable, allowedSymbols: ["x", "y", ...Object.keys(params)], params });
    return value.expression ? simplify(value.expression) : null;
  };
  const a = derivative(first, "x"), b = derivative(first, "y");
  const c = derivative(second, "x"), d = derivative(second, "y");
  if ([a, b, c, d].some((value) => value === null)) return { ...base, conclusion: "Closed-form solving is unavailable; inspect the residual equations.", errors: ["This solver supports identities, contradictions, and independent linear systems."] };
  if (![a!, b!, c!, d!].every((value) => derivative(value, "x") === "0" && derivative(value, "y") === "0")) return { ...base, conclusion: "Nonlinear residual system: no closed-form solution is claimed.", steps: [`${first} = 0`, `${second} = 0`], errors: ["Automatic location solving currently supports linear residual systems."] };
  const f = simplify(substituteFieldSymbols(first, { x: "0", y: "0" }));
  const g = simplify(substituteFieldSymbols(second, { x: "0", y: "0" }));
  if ((a === "0" && b === "0" && Number.isFinite(Number(f)) && Number(f) !== 0) || (c === "0" && d === "0" && Number.isFinite(Number(g)) && Number(g) !== 0)) return { ...base, conclusion: "No solutions: a residual is a nonzero constant.", steps: [`${first} = 0`, `${second} = 0`] };
  const determinant = simplify(`(${a})*(${d})-(${b})*(${c})`);
  if (!determinant || determinant === "0") return { ...base, conclusion: "Dependent residual equations; inspect the conditions below.", steps: [`${first} = 0`, `${second} = 0`], errors: ["A unique point cannot be obtained from a singular coefficient matrix."] };
  const x = simplify(`((${b})*(${g})-(${d})*(${f}))/(${determinant})`);
  const y = simplify(`((${c})*(${f})-(${a})*(${g}))/(${determinant})`);
  if (!x || !y || [first, second].some((residual) => simplify(substituteFieldSymbols(residual, { x, y })) !== "0")) return { ...base, conclusion: "Candidate solution could not be verified symbolically." };
  return { ...base, expressions: [x, y], basis: "x, y", steps: [`Residual equations: ${first} = 0; ${second} = 0`, `Coefficient determinant = ${determinant}`, "This solution requires a nonzero coefficient determinant and a point in the original field's differentiable domain.", "Solve the two linear equations by elimination.", `x = ${x}; y = ${y}`, "Substitution makes both residuals identically zero. An isolated solution does not establish analyticity on a region."] };
}
