import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs";
import { expressionToLatex, normalizeMathInput, placeholderToLatex } from "@/lib/math/mathNotation";
import { latexToExpression } from "@/lib/math/mathInputConversion";

describe("mathematical notation boundary", () => {
  it("accepts function powers without changing their meaning", () => {
    const expression = normalizeMathInput("6*cos^2(x^2)");
    expect(evaluate(expression, { x: .7 })).toBeCloseTo(6 * Math.cos(.7 ** 2) ** 2);
    expect(expressionToLatex(expression)).toContain("\\cos^{2}");
    expect(normalizeMathInput("cos^2(sin^3(x))")).toBe("(cos((sin(x))^3))^2");
    expect(normalizeMathInput("cos^2(")).toBe("cos^2(");
  });

  it.each(["6*cos^2(x^2)", "sqrt(1+x^2)/(1+x)", "sin(x)*cos(y)", "atan2(y,x)", "exp(x)", "log(x,2)", "abs(x)", "min(x,y)", "pi*x+theta", "rate*x", "floor(x)", "ceil(x)", "round(x,2)", "pow(x,2)", "sign(x)", "asin(x)", "acos(x)", "atan(x)", "cos(x)^-1"])("round trips %s through the visual editor", (source) => {
    const latex = expressionToLatex(source)!;
    const canonical = latexToExpression(latex)!;
    expect(canonical).not.toBeNull();
    const scope = { x: .7, y: .2, theta: .3, rate: 2 };
    expect(evaluate(canonical, scope)).toBeCloseTo(evaluate(normalizeMathInput(source), scope));
  });

  it("preserves equation and vector notation and rejects unsafe display input", () => {
    expect(expressionToLatex("F = <x^2, sqrt(y), 0>")).toContain("\\langle");
    expect(expressionToLatex("∇g = <∂g/∂x, ∂g/∂y>")).toContain("\\frac");
    expect(expressionToLatex("x = 2")).toBe(" x = 2");
    expect(expressionToLatex("<img src=x onerror=alert(1)>")).toBeNull();
    expect(expressionToLatex("x; y")).toBeNull();
    expect(expressionToLatex("x".repeat(2049))).toBeNull();
    expect(latexToExpression("x+")).toBeNull();
    expect(latexToExpression("\\htmlClass{evil}{x}")).toBeNull();
  });

  it("typesets coordinate tuples and labeled geometry without evaluating their sources", () => {
    expect(expressionToLatex("P=(sin(a),2,3)")).toContain("\\left(");
    expect(expressionToLatex("L:(-1,0,0)+t<3,2,1>")).toContain("\\mathrm{L}");
    expect(expressionToLatex("R:(0,0,0)+t<1,2,3>,t≥0")).toContain("t\\ge 0");
    expect(expressionToLatex("S:(0,0,0)→(sin(a),1,2)")).toContain("\\longrightarrow");
    expect(expressionToLatex("L:(x;alert(1),0,0)+t<1,0,0>")).toBeNull();
  });
});

describe("math editor hints", () => {
  it("preserves spaces in prose and typesets mathematical examples", () => {
    expect(placeholderToLatex("Type an equation")).toBe("\\textit{Type an equation}");
    expect(placeholderToLatex("x^2 + y^2 = 1")).toBe(expressionToLatex("x^2 + y^2 = 1"));
    expect(placeholderToLatex("Use {x} & y")).toBe("\\textit{Use \\{x\\} \\& y}");
  });
});
