import type { GraphObject, ImplicitSurfaceDomain, ObjectOperation } from "@vinculum/scene/types";
import { defaultCurveExtensionRange, defaultImplicitSurfaceDomain } from "@vinculum/scene/defaults";
import { inferGraphEquation } from "../expressions/inferGraphEquation";
import { splitSingleMathEquality } from "../expressions/implicitEquation";
import { getEffectiveSurfaceOrientation } from "../expressions/surfaceExpressionOrientation";
import { compileImplicitSurfaceExpression } from "../expressions/compileImplicitSurface";
import { validateExpressionSafety } from "../expressions/expressionSafety";

export const MAX_OBJECT_OPERATION_DEPTH = 12;
export type ObjectOperationDefinition = { equation: string; kind: "implicitCurve" | "implicitSurface"; domain: ImplicitSurfaceDomain };
export type ObjectOperationResult = { ok: true; definition: ObjectOperationDefinition } | { ok: false; error: string };

export function objectRegionDimension(object: GraphObject): "2d" | "3d" | null {
  if (object.kind === "implicitCurve") return object.extendTo3D ? "3d" : "2d";
  return object.kind === "surface" || object.kind === "implicitSurface" || object.kind === "plane" ? "3d" : null;
}

function residual(equation: string): string {
  const equality = splitSingleMathEquality(equation);
  return equality ? `(${equality.lhs})-(${equality.rhs})` : equation;
}

const maximum = (terms: string[]) => terms.reduce((a, b) => `max((${a}),(${b}))`);

function region(object: GraphObject, params: Record<string, number>): { expression: string; domain: ImplicitSurfaceDomain } {
  const domain = { ...defaultImplicitSurfaceDomain };
  let expression: string;
  const clips: string[] = [];
  if (object.kind === "implicitCurve") {
    const inferred = inferGraphEquation(object.equation, params);
    if (!inferred.ok || inferred.dimension !== "2d") throw new Error(inferred.ok ? "Use a 2D equation in x and y." : inferred.error);
    expression = residual(inferred.relation);
    if (object.extendTo3D) {
      Object.assign(domain, object.extensionRange ?? defaultCurveExtensionRange);
      clips.push(`${domain.zMin}-z`, `z-(${domain.zMax})`);
    }
  } else if (object.kind === "surface") {
    const { body, effectiveOrientation } = getEffectiveSurfaceOrientation(object.equation, object.orientation);
    expression = `${effectiveOrientation}-(${body})`;
    const axes = effectiveOrientation === "x" ? ["y", "z"] : effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
    const ranges = [[object.domain.xMin, object.domain.xMax], [object.domain.yMin, object.domain.yMax]];
    axes.forEach((axis, index) => {
      Object.assign(domain, { [`${axis}Min`]: ranges[index][0], [`${axis}Max`]: ranges[index][1] });
      clips.push(`${ranges[index][0]}-${axis}`, `${axis}-(${ranges[index][1]})`);
    });
  } else if (object.kind === "implicitSurface") {
    expression = residual(object.equation);
    Object.assign(domain, object.domain);
    for (const axis of ["x", "y", "z"] as const) clips.push(`${domain[`${axis}Min`]}-${axis}`, `${axis}-(${domain[`${axis}Max`]})`);
  } else if (object.kind === "plane") {
    expression = residual(object.equation);
    for (const axis of ["x", "y", "z"] as const) {
      domain[`${axis}Min`] = -object.size / 2;
      domain[`${axis}Max`] = object.size / 2;
    }
  } else {
    throw new Error("Use an equation curve, explicit surface, implicit surface, or plane. Parametric objects do not define an inside region.");
  }
  const compiled = compileImplicitSurfaceExpression(expression, params);
  if (compiled.error) throw new Error(compiled.error);
  return { expression: clips.length ? maximum([expression, ...clips]) : expression, domain };
}

/** Region operations use F <= 0; their zero set is the resulting boundary. */
export function buildObjectOperation(a: GraphObject, b: GraphObject, operation: ObjectOperation, params: Record<string, number>): ObjectOperationResult {
  const dimension = objectRegionDimension(a);
  if (!dimension || !objectRegionDimension(b)) return { ok: false, error: "These objects do not define regions. Use equation curves or surfaces." };
  if (dimension !== objectRegionDimension(b)) return { ok: false, error: "Combine two 2D regions or two 3D regions. Extend a 2D curve to 3D first to combine it with a surface." };
  try {
    const first = region(a, params), second = region(b, params);
    const domain = { ...first.domain };
    let empty = false;
    if (operation !== "subtract") for (const axis of ["x", "y", "z"] as const) {
      domain[`${axis}Min`] = operation === "union" ? Math.min(first.domain[`${axis}Min`], second.domain[`${axis}Min`]) : Math.max(first.domain[`${axis}Min`], second.domain[`${axis}Min`]);
      domain[`${axis}Max`] = operation === "union" ? Math.max(first.domain[`${axis}Max`], second.domain[`${axis}Max`]) : Math.min(first.domain[`${axis}Max`], second.domain[`${axis}Max`]);
      if (domain[`${axis}Min`] >= domain[`${axis}Max`]) empty = true;
    }
    const expression = operation === "union" ? `min((${first.expression}),(${second.expression}))`
      : operation === "intersection" ? `max((${first.expression}),(${second.expression}))`
        : `max((${first.expression}),-(${second.expression}))`;
    const equation = empty && dimension === "3d" ? "1 = 0" : `${expression} = 0`;
    const safe = validateExpressionSafety(equation.slice(0, -4), { operation: "combine-objects", expressionLabel: "Combined equation", allowedSymbols: Object.keys(params) });
    if (!safe.ok) return { ok: false, error: safe.violation.message };
    return { ok: true, definition: { equation, kind: dimension === "2d" ? "implicitCurve" : "implicitSurface", domain: empty ? first.domain : domain } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Check both source definitions." };
  }
}

/** Resolve a dependency DAG once per scene edit, never from a renderer tick. */
export function resolveObjectCombinations(objects: GraphObject[], params: Record<string, number>, errors: string[] = [], strict = false): GraphObject[] {
  const byId = new Map(objects.map(object => [object.id, object]));
  const resolved = new Map<string, GraphObject>();
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (object: GraphObject, depth = 0): GraphObject => {
    const cached = resolved.get(object.id);
    if (cached) return cached;
    if (!object.combination) { resolved.set(object.id, object); depths.set(object.id, 0); return object; }
    if (depth > MAX_OBJECT_OPERATION_DEPTH || visiting.has(object.id)) {
      errors.push("Object operations must be acyclic and at most 12 levels deep.");
      return object;
    }
    visiting.add(object.id);
    const operands = object.combination.operands.map(id => byId.get(id));
    if (!operands[0] || !operands[1] || operands[0].id === operands[1].id) {
      errors.push(`Operation ${object.id} requires two different existing source objects.`);
      visiting.delete(object.id);
      return object;
    }
    const a = resolve(operands[0], depth + 1), b = resolve(operands[1], depth + 1);
    const resultDepth = 1 + Math.max(depths.get(a.id) ?? 0, depths.get(b.id) ?? 0);
    if (resultDepth > MAX_OBJECT_OPERATION_DEPTH) errors.push("Object operations must be at most 12 levels deep.");
    depths.set(object.id, resultDepth);
    const result = buildObjectOperation(a, b, object.combination.operation, params);
    let next = object;
    if (result.ok) {
      const { definition } = result;
      const same = "equation" in object && object.equation === definition.equation && object.kind === definition.kind &&
        (object.kind !== "implicitSurface" || JSON.stringify(object.domain) === JSON.stringify(definition.domain));
      if (!same) {
        const base = { id: object.id, color: object.color, visible: object.visible, combination: object.combination };
        next = definition.kind === "implicitCurve"
          ? { ...base, kind: "implicitCurve", equation: definition.equation, ...(object.kind === "implicitCurve" ? { extendTo3D: object.extendTo3D, extensionRange: object.extensionRange } : {}) }
          : { ...base, kind: "implicitSurface", equation: definition.equation, domain: definition.domain, resolution: object.kind === "implicitSurface" ? object.resolution : 48, appearance: "appearance" in object ? object.appearance : { wireframe: false } };
      }
    } else {
      if (strict) errors.push(`Operation ${object.id}: ${result.error}`);
      // Invalid source drafts cannot leave a healthy-looking stale result.
      if ("equation" in object && object.equation) next = { ...object, equation: "" };
    }
    visiting.delete(object.id);
    resolved.set(object.id, next);
    return next;
  };
  const next = objects.map(object => resolve(object));
  return next.every((object, index) => object === objects[index]) ? objects : next;
}

export function objectCombinationReferences(objects: GraphObject[], removedId: string): Set<string> {
  const removed = new Set([removedId]);
  for (let pass = 0; pass <= MAX_OBJECT_OPERATION_DEPTH; pass++) {
    let changed = false;
    for (const object of objects) if (!removed.has(object.id) && object.combination?.operands.some(id => removed.has(id))) {
      removed.add(object.id); changed = true;
    }
    if (!changed) break;
  }
  return removed;
}
