import type { SceneParameter } from "./sceneSchema";
import { getEquationParameterNames } from "@/lib/store/editorParameters";
import { MAX_SCENE_OBJECT_COUNT } from "./importPayloadLimits";

const capturedNames = new WeakMap<readonly unknown[], { all: Set<string>; automatic: string[] }>();

/** Only mathematical definition fields contribute to the saved scope. */
export function getSceneParameterNames(objects: readonly unknown[]): string[] {
  const names = new Set<string>();
  for (const object of objects.slice(0, MAX_SCENE_OBJECT_COUNT)) {
    if (!object || typeof object !== "object" || Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (typeof value === "string" && (key === "equation" || key.endsWith("Expr") || /^m[123][123]$/.test(key))) {
        for (const name of getEquationParameterNames(value)) names.add(name);
      }
    }
  }
  return [...names].sort();
}

export function completeSceneParameters(objects: readonly unknown[], parameters: readonly SceneParameter[]): SceneParameter[] {
  const entries = new Map(parameters.map(parameter => [parameter.id, { ...parameter }]));
  const automatic = objects.filter(object => object && typeof object === "object" && ('autoExpression' in object && object.autoExpression === true || 'kind' in object && object.kind === "implicitCurve"));
  for (const id of getSceneParameterNames(automatic)) {
    if (!entries.has(id)) entries.set(id, { id, value: 1, min: -10, max: 10 });
  }
  return [...entries.values()];
}

export function captureSceneParameters(objects: readonly unknown[], parameters: readonly SceneParameter[]): SceneParameter[] {
  let names = capturedNames.get(objects);
  if (!names) {
    const automatic = objects.filter(object => object && typeof object === "object" && ("autoExpression" in object && object.autoExpression === true || "kind" in object && object.kind === "implicitCurve"));
    names = { all: new Set(getSceneParameterNames(objects)), automatic: getSceneParameterNames(automatic) };
    capturedNames.set(objects, names);
  }
  const entries = new Map(parameters.filter(parameter => parameter.defined || names.all.has(parameter.id)).map(parameter => [parameter.id, { ...parameter }]));
  for (const id of names.automatic) {
    if (!entries.has(id)) entries.set(id, { id, value: 1, min: -10, max: 10 });
  }
  return [...entries.values()];
}
