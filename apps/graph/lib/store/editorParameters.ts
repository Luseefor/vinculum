import { parse } from "mathjs";
import { splitSingleMathEquality } from "@/lib/math/implicitEquation";
import { validateExpressionSafety } from "@/lib/math/expressionSafety";
import { useEditorStore } from "@/lib/store/editorStore";

export interface ParameterScopeEntry {
  id: string;
  value: number;
}

export function parametersToScope(parameters: readonly ParameterScopeEntry[]): Record<string, number> {
  const scope: Record<string, number> = {};

  for (const parameter of parameters) {
    const key = parameter.id.trim();
    if (!key) {
      continue;
    }
    scope[key] = parameter.value;
  }

  return scope;
}

export function getEditorParameterScope(): Record<string, number> {
  return parametersToScope(useEditorStore.getState().parameters);
}

const RESERVED_PARAMETER_NAMES = new Set(["x", "y", "z", "t", "u", "v", "pi", "e", "i", "Infinity", "NaN", "true", "false", "constructor", "prototype"]);
export function isParameterName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !RESERVED_PARAMETER_NAMES.has(name);
}

/** Discover scalar symbols only after structural/function validation; never evaluate drafts. */
export function getEquationParameterNames(source: string): string[] {
  const equality = splitSingleMathEquality(source);
  if (source.includes("=") && !equality) return [];
  const functionDefinition = equality && /^[A-Za-z]\(\s*[xyz](?:\s*,\s*[xyz])*\s*\)$/.test(equality.lhs);
  const expressions = equality ? functionDefinition ? [equality.rhs] : [equality.lhs, equality.rhs] : [source];
  const names = new Set<string>();
  for (const expression of expressions) {
    if (!validateExpressionSafety(expression, { operation: "discover-equation-parameters", expressionLabel: "Equation" }).ok) return [];
    try {
      parse(expression).traverse((node, path) => {
        if (path !== "fn" && node.type === "SymbolNode") {
          const name = (node as typeof node & { name: string }).name;
          if (isParameterName(name)) names.add(name);
        }
      });
    } catch { return []; }
  }
  return [...names].sort();
}
