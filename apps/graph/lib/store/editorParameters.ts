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
