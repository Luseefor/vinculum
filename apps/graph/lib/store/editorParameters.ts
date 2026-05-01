import { useEditorStore } from "@/lib/store/editorStore";

export function getEditorParameterScope(): Record<string, number> {
  const parameters = useEditorStore.getState().parameters;
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
