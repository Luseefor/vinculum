import { ComputeEngine } from "@cortex-js/compute-engine";
import { MAX_EXPRESSION_LENGTH } from "@/lib/math/expressions/expressionSafety";

const engine = new ComputeEngine();
const names: Record<string, string> = {
  Sin: "sin", Cos: "cos", Tan: "tan", Cot: "cot", Sec: "sec", Csc: "csc",
  Sinh: "sinh", Cosh: "cosh", Tanh: "tanh", Coth: "coth", Sech: "sech", Csch: "csch",
  Arcsin: "asin", Arccos: "acos", Arctan: "atan", Arccot: "acot", Arcsec: "asec", Arccsc: "acsc",
  Arsinh: "asinh", Arcosh: "acosh", Artanh: "atanh",
  Sqrt: "sqrt", Abs: "abs", Exp: "exp", Ln: "log", Lg: "log10", Floor: "floor", Ceil: "ceil", Ceiling: "ceil", Round: "round", Min: "min", Max: "max", Sign: "sign", Gamma: "gamma"
};
const constants: Record<string, string> = { Pi: "pi", ExponentialE: "e", ImaginaryUnit: "i", Theta: "theta", Infinity: "Infinity" };

function serialize(value: unknown, depth = 0): string {
  if (depth > 64) throw new Error("Expression is too deeply nested.");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value) || ["Nothing", "Missing", "Placeholder", "topic_marker"].includes(value)) throw new Error("Incomplete expression.");
    return constants[value] ?? value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as { num?: string; sym?: string; fn?: unknown[] };
    if (object.num && /^[-+0-9.eE]+$/.test(object.num)) return object.num;
    if (object.sym) return serialize(object.sym, depth + 1);
    if (object.fn) return serialize(object.fn, depth + 1);
  }
  if (!Array.isArray(value)) throw new Error("Unsupported notation.");
  const [head, ...args] = value;
  const next = (arg: unknown) => serialize(arg, depth + 1);
  if (head === "Apply" && Array.isArray(args[0]) && args[0][0] === "InverseFunction") {
    const inverse: Record<string, string> = { Sin: "asin", Cos: "acos", Tan: "atan", Sinh: "asinh", Cosh: "acosh", Tanh: "atanh" };
    const fn = inverse[String(args[0][1])];
    if (fn) return `${fn}(${next(args[1])})`;
  }
  if (head === "Delimiter") return `(${next(args[0])})`;
  if (head === "__unit__" && args.length === 1 && args[0] === "t") return "t";
  if (head === "Sequence" || head === "Tuple" || head === "List") return args.map(next).join(",");
  if (head === "InvisibleOperator" || head === "Multiply") {
    // Mathjs functions typeset as operator names parse as a symbol + argument delimiter.
    if (args.length === 2 && typeof args[0] === "string" && Array.isArray(args[1]) && args[1][0] === "Delimiter" && /^(atan2|log|log10|log2|pow|nthRoot|hypot|mod|round|min|max|sign|floor|ceil|abs|sqrt|exp)$/.test(args[0])) {
      return `${args[0]}(${next(args[1][1])})`;
    }
    return args.map((arg) => `(${next(arg)})`).join("*");
  }
  if (head === "Add") return args.map((arg) => `(${next(arg)})`).join("+");
  if (head === "Subtract") return `(${next(args[0])})-(${next(args[1])})`;
  if (head === "Negate") return `-(${next(args[0])})`;
  if (head === "Divide" || head === "Rational") return `(${next(args[0])})/(${next(args[1])})`;
  if (head === "Power") return `(${next(args[0])})^(${next(args[1])})`;
  if (head === "Square") return `(${next(args[0])})^2`;
  if (head === "Root") return `(${next(args[0])})^(1/(${next(args[1])}))`;
  if (head === "Equal") return args.map(next).join("=");
  const comparison: Record<string, string> = { Less: "<", LessEqual: "<=", Greater: ">", GreaterEqual: ">=", NotEqual: "!=", And: "and", Or: "or" };
  if (typeof head === "string" && comparison[head]) return args.map(arg => `(${next(arg)})`).join(` ${comparison[head]} `);
  if (head === "Lb") return `log(${next(args[0])},2)`;
  if (head === "Log") return `log(${args.map(next).join(",")})`;
  if (head === "Factorial") return `(${next(args[0])})!`;
  if (typeof head === "string" && names[head]) return `${names[head]}(${args.map(next).join(",")})`;
  throw new Error("Incomplete or unsupported notation.");
}

/** Decode, never evaluate. Canonical validators still decide which operations are supported. */
export function latexToExpression(latex: string): string | null {
  if (!latex.trim()) return "";
  if (latex.length > MAX_EXPRESSION_LENGTH * 8) return null;
  try {
    if (latex.includes("\\begin{cases}")) {
      const match = latex.match(/^(.*?)\\begin\{cases\}([\s\S]*?)\\end\{cases\}(.*?)$/);
      if (!match || match[2]!.includes("\\begin")) return null;
      const rows = match[2]!.split(/\\\\/).map(row => row.trim()).filter(Boolean);
      if (!rows.length || rows.length > 16) return null;
      let body = "(0/0)";
      for (let i = rows.length - 1; i >= 0; i--) {
        const columns = rows[i]!.split("&");
        if (columns.length !== 2) return null;
        const value = latexToExpression(columns[0]!);
        if (!value) return null;
        if (/^\\text\{otherwise\}$/.test(columns[1]!.trim())) {
          if (i !== rows.length - 1) return null;
          body = `(${value})`;
        } else {
          const condition = latexToExpression(columns[1]!);
          if (!condition) return null;
          body = `((${condition.replace(/(?<![<>=!])=(?!=)/g, "==")}) ? (${value}) : ${body})`;
        }
      }
      // Cases may be surrounded by Mathjs's optional parenthesis delimiters.
      const prefix = match[1]!.replace(/\\left\($/, "");
      const suffix = match[3]!.replace(/^\\right\)/, "");
      const label = prefix.trim().replace(/=$/, "").trim();
      const functionLabel = label.match(/^(?:\\mathrm\{)?([A-Za-z])\}?\\left\((.*?)\\right\)$/);
      const functionArguments = functionLabel ? latexToExpression(functionLabel[2]!) : null;
      if (functionLabel && functionArguments === null) return null;
      const before = functionLabel ? `${functionLabel[1]}(${functionArguments!.replace(/^\((.*)\)$/, "$1")})` : label ? latexToExpression(label) : "";
      if (before === null || suffix.trim()) return null;
      const result = `${before ? `${before}=` : ""}${body}`;
      return result.length <= MAX_EXPRESSION_LENGTH ? result : null;
    }
    const result = serialize(engine.parse(latex, { form: "raw" }).json);
    return result.length <= MAX_EXPRESSION_LENGTH ? result : null;
  } catch { return null; }
}
