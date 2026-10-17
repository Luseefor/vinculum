import { getEquationParameterNames } from "@/lib/store/editorParameters";
import { parse, type MathNode } from "mathjs";
import { splitSingleMathEquality } from "./implicitEquation";
import { validateExpressionSafety } from "./expressionSafety";
import { compileImplicitSurfaceExpression } from "./compileImplicitSurface";
import { compileSurfaceExpression } from "./compileExpression";
import type { SurfaceOrientation } from "@vinculum/scene/types";

type EquationInference =
  | { ok: false; error: string }
  | { ok: true; dimension: "2d" | "3d"; kind: "implicitCurve" | "surface" | "implicitSurface"; relation: string; orientation: SurfaceOrientation; explicitAxis?: SurfaceOrientation };

/** Classify mathematical relations from parsed symbols, never substring matches. */
export function inferGraphEquation(source: string, params: Record<string, number> = {}): EquationInference {
  params = { ...Object.fromEntries(getEquationParameterNames(source).map(name => [name, 1])), ...params };
  const raw = source.trim();
  if (!raw) return { ok: false, error: "Enter an equation." };
  const equality = splitSingleMathEquality(raw);
  if (raw.includes("=") && !equality) return { ok: false, error: "Use one '=' with an expression on each side." };
  const functionDefinition = equality?.lhs.match(/^[a-zA-Z]\(\s*([xyz](?:\s*,\s*[xyz])*)\s*\)$/);
  const sources = functionDefinition ? [equality!.rhs] : equality ? [equality.lhs, equality.rhs] : [raw];
  const variables = new Set<string>(functionDefinition?.[1]?.split(/\s*,\s*/) ?? []);
  for (const expression of sources) {
    const safe = validateExpressionSafety(expression, { operation: "infer-graph-equation", expressionLabel: "Equation", allowedSymbols: Object.keys(params) });
    if (!safe.ok) return { ok: false, error: safe.violation.message };
    try {
      const node = parse(expression);
      let unsupported = false;
      node.traverse((child: MathNode, path: string) => {
        if (path === "fn" || child.type !== "SymbolNode") return;
        const name = (child as MathNode & { name: string }).name;
        if (["x", "y", "z"].includes(name)) variables.add(name);
        if (["t", "u", "v"].includes(name)) unsupported = true;
      });
      if (unsupported) return { ok: false, error: "Use x, y, and z here. Add a parametric curve for t, u, or v." };
    } catch {
      return { ok: false, error: "Check the equation's parentheses and operators." };
    }
  }
  if (functionDefinition && variables.size === 3) return { ok: false, error: "A graphing function needs one or two input variables. Use a relation such as x+y+z=0 for a 3D level set." };
  let relation = raw;
  let orientation: SurfaceOrientation = "z";
  if (!equality || functionDefinition) {
    const body = equality ? equality.rhs : raw;
    // One-variable expressions are graphs in the xy plane. Two-variable
    // scalar expressions use the remaining output axis, normally z.
    orientation = !variables.has("z") && variables.size <= 1
      ? variables.has("y") ? "x" : "y"
      : (["z", "y", "x"] as const).find((axis) => !variables.has(axis)) ?? "z";
    relation = variables.size === 3 ? `${body} = 0` : `${orientation} = ${body}`;
  } else if (/^[xyz]$/.test(equality.lhs)) {
    orientation = equality.lhs as SurfaceOrientation;
  }
  const dimension = variables.has("z") || (!equality && variables.size > 1) || Boolean(functionDefinition && variables.size > 1) ? "3d" : "2d";
  const checked = compileImplicitSurfaceExpression(relation, params);
  if (checked.error) return { ok: false, error: checked.error };
  const parts = splitSingleMathEquality(relation)!;
  const explicit = /^[xyz]$/.test(parts.lhs) && !referencesAxis(parts.rhs, parts.lhs);
  if (dimension === "2d") return { ok: true, dimension, kind: "implicitCurve", relation, orientation, ...(explicit ? { explicitAxis: parts.lhs as SurfaceOrientation } : {}) };
  if (explicit) {
    orientation = parts.lhs as SurfaceOrientation;
    const surface = compileSurfaceExpression(relation, orientation, params);
    if (surface.error) return { ok: false, error: surface.error };
  }
  return { ok: true, dimension, kind: explicit ? "surface" : "implicitSurface", relation, orientation };
}

function referencesAxis(expression: string, axis: string): boolean {
  let found = false;
  parse(expression).traverse((node: MathNode, path: string) => {
    if (path !== "fn" && node.type === "SymbolNode" && (node as MathNode & { name: string }).name === axis) found = true;
  });
  return found;
}
