import { parse, type MathNode, type OperatorNode, type FunctionNode } from "mathjs";
import { MAX_EXPRESSION_LENGTH } from "@/lib/math/expressionSafety";

/** Accept familiar trig-power notation at the editing boundary, without changing scene storage. */
export function normalizeMathInput(source: string): string {
  if (source.length > MAX_EXPRESSION_LENGTH) return source;
  let result = source.replaceAll("−", "-").replaceAll("×", "*").replaceAll("÷", "/").replaceAll("π", "pi").replaceAll("θ", "theta").replaceAll("²", "^2").replaceAll("³", "^3");
  result = result.replace(/\b(?:xy|yx|xz|zx|yz|zy|xyz|xzy|yxz|yzx|zxy|zyx)\b/g, word => word.split("").join("*"));
  const pattern = /\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\s*\^\s*(\d+(?:\.\d+)?|\([^()]*\))\s*\(/g;
  // Rewrite from the innermost call outward, retaining the argument's parentheses.
  for (let pass = 0; pass < 16; pass++) {
    const matches = [...result.matchAll(pattern)];
    if (!matches.length) break;
    let changed = false;
    for (const match of matches.reverse()) {
      const start = match.index!;
      const argumentStart = start + match[0].length;
      let depth = 1;
      let end = argumentStart;
      for (; end < result.length; end++) {
        if (result[end] === "(") depth++;
        if (result[end] === ")" && --depth === 0) break;
      }
      if (depth !== 0) continue;
      result = result.slice(0, start) + `(${match[1]}(${result.slice(argumentStart, end)}))^${match[2]}` + result.slice(end + 1);
      changed = true;
    }
    if (!changed) break;
  }
  return result;
}

function splitTopLevel(source: string, separator: string): string[] {
  let depth = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < source.length; i++) {
    if ("([{".includes(source[i]!)) depth++;
    if (")] }".replace(" ", "").includes(source[i]!)) depth--;
    if (source[i] === separator && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
  }
  parts.push(source.slice(start));
  return parts;
}

const texOptions = { parenthesis: "auto" as const, implicit: "hide" as const, handler: trigPower };
function trigPower(node: MathNode): string | undefined {
  if (node.type === "SymbolNode") {
    const name = (node as MathNode & { name: string }).name;
    if (/^[A-Za-z][A-Za-z0-9_]+$/.test(name) && !["pi", "theta", "alpha", "beta", "gamma", "delta", "epsilon", "lambda", "mu", "sigma", "phi", "omega"].includes(name)) return `\\mathrm{${name.replaceAll("_", "\\_")}}`;
  }
  if (node.type !== "OperatorNode") return undefined;
  const operator = node as OperatorNode;
  if (operator.op !== "^") return undefined;
  let base = operator.args[0]!;
  if (base.type === "ParenthesisNode") base = (base as MathNode & { content: MathNode }).content;
  if (base.type !== "FunctionNode") return undefined;
  const fn = base as FunctionNode;
  if (!/^(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)$/.test((fn.fn as MathNode & { name: string }).name)) return undefined;
  if (operator.args[1]!.toString().startsWith("-")) return `\\left(${fn.toTex(texOptions)}\\right)^{${operator.args[1]!.toTex(texOptions)}}`;
  return `\\${(fn.fn as MathNode & { name: string }).name}^{${operator.args[1]!.toTex(texOptions)}}\\left(${fn.args.map((arg) => arg.toTex(texOptions)).join(",")}\\right)`;
}

/** Returns null for prose or unfinished syntax; callers render the source safely. Never evaluates. */
export function expressionToLatex(source: string): string | null {
  const text = source.trim();
  if (!text || text.length > MAX_EXPRESSION_LENGTH) return null;
  // Geometry definitions are presentation notation, never executable input.
  const line = text.match(/^([LR]):(\(.+\))\+t(<.+>)(,t≥0)?$/);
  if (line) {
    const point = expressionToLatex(line[2]!);
    const direction = expressionToLatex(line[3]!);
    return point && direction ? `\\mathrm{${line[1]}}:\\;${point} + t${direction}${line[4] ? "\\quad t\\ge 0" : ""}` : null;
  }
  const segment = text.match(/^S:(\(.+\))→(\(.+\))$/);
  if (segment) {
    const start = expressionToLatex(segment[1]!);
    const end = expressionToLatex(segment[2]!);
    return start && end ? `\\mathrm{S}:\\;${start}\\longrightarrow ${end}` : null;
  }
  if (text.startsWith("(") && text.endsWith(")")) {
    const components = splitTopLevel(text.slice(1, -1), ",");
    if (components.length > 1) {
      const rendered = components.map(expressionToLatex);
      return rendered.every(Boolean) ? `\\left(${rendered.join(",\\,")}\\right)` : null;
    }
  }
  if (text.startsWith("<") && text.endsWith(">")) {
    const components = splitTopLevel(text.slice(1, -1), ",").map(expressionToLatex);
    return components.every(Boolean) ? `\\left\\langle ${components.join(",\\,")} \\right\\rangle` : null;
  }
  const sides = splitTopLevel(text, "=");
  if (sides.length > 1) {
    const rendered = sides.map(expressionToLatex);
    return rendered.every(Boolean) ? rendered.join(" = ") : null;
  }
  const derivative = text.match(/^∂(²)?(.+)\/∂([xyzrtθ]|theta)(²)?$/);
  if (derivative) {
    const body = expressionToLatex(derivative[2]!);
    if (body) return `\\frac{\\partial${derivative[1] ? "^2" : ""} ${body}}{\\partial ${derivative[3] === "θ" ? "\\theta" : derivative[3]}${derivative[4] ? "^2" : ""}}`;
  }
  if (/^[∇Δ][A-Za-z]$/.test(text)) return `${text[0] === "∇" ? "\\nabla" : "\\Delta"} ${text[1]}`;
  if (/^(?:div|curl) [A-Za-z]$/.test(text)) return `\\operatorname{${text.split(" ")[0]}} ${text.at(-1)}`;
  if (/\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\b/.test(text)) return null;
  // Definitions and proof labels that are not mathematical expressions stay text.
  if (/\b(?:unavailable|undefined|omit|direction|Evaluate|point|then|where|in|zero)\b/i.test(text)) return null;
  try {
    const node = parse(normalizeMathInput(text));
    let count = 0;
    let safe = true;
    node.traverse((part) => {
      count++;
      if (part.type === "FunctionNode" && !(part as FunctionNode).args.length) safe = false;
      if (["AssignmentNode", "FunctionAssignmentNode", "BlockNode", "AccessorNode", "ObjectNode"].includes(part.type)) safe = false;
    });
    return safe && count <= 2500 ? node.toTex(texOptions) : null;
  } catch { return null; }
}

/** Non-editable hints retain prose spaces and use italic mathematical type. */
export function placeholderToLatex(source: string): string {
  return (/\b[A-Za-z]{2,}\s+[A-Za-z]{2,}\b/.test(source) ? null : expressionToLatex(source)) ?? `\\textit{${source.replace(/[\\{}%$&#_^]/g, character => character === "\\" ? "\\textbackslash{}" : `\\${character}`)}}`;
}
