import type { GraphObject } from "@vinculum/scene/types";
import { tryCompileMathExpression } from "./graph2dCanvasCompile";
import { escapeRegExp, splitImplicitEquation } from "./graph2dCanvasImplicitParse";
import type { AxisPairSpec, RenderableGraph } from "./graph2dCanvasTypes";

export function tryAppendImplicitRenderableGraph(
  graphs: RenderableGraph[],
  obj: GraphObject,
  axisPair: AxisPairSpec,
  numericSource: string
): boolean {
  const implicitParts = splitImplicitEquation(numericSource);
  if (!implicitParts) {
    return false;
  }
  const lhs = tryCompileMathExpression(implicitParts.lhs);
  const rhs = tryCompileMathExpression(implicitParts.rhs);
  if (!lhs || !rhs) {
    return false;
  }
  graphs.push({
    id: obj.id,
    color: obj.color,
    verticalLineValue: null,
    horizontalLineValue: null,
    evaluate: null,
    implicitEvaluate: (horizontalValue: number, verticalValue: number) => {
      try {
        const scope: Record<string, number> = {
          x: 0,
          y: 0,
          z: 0,
          t: horizontalValue,
          pi: Math.PI,
          e: Math.E
        };
        scope[axisPair.horizontal] = horizontalValue;
        scope[axisPair.vertical] = verticalValue;
        const leftResult = lhs.evaluate(scope);
        const rightResult = rhs.evaluate(scope);
        const leftNumeric = typeof leftResult === "number" ? leftResult : Number(leftResult);
        const rightNumeric = typeof rightResult === "number" ? rightResult : Number(rightResult);
        if (!Number.isFinite(leftNumeric) || !Number.isFinite(rightNumeric)) {
          return null;
        }
        return leftNumeric - rightNumeric;
      } catch {
        return null;
      }
    },
    hatchDomain: null,
    polylineHV: null
  });
  return true;
}

export function tryAppendSurfaceHatchRenderable(
  graphs: RenderableGraph[],
  obj: GraphObject,
  axisPair: AxisPairSpec,
  effectiveDependent: string | null
): boolean {
  if (obj.kind !== "surface" || !effectiveDependent || effectiveDependent === axisPair.vertical) {
    return false;
  }
  graphs.push({
    id: obj.id,
    color: obj.color,
    verticalLineValue: null,
    horizontalLineValue: null,
    evaluate: null,
    implicitEvaluate: null,
    hatchDomain: {
      hMin: Math.min(obj.domain.xMin, obj.domain.xMax),
      hMax: Math.max(obj.domain.xMin, obj.domain.xMax),
      vMin: Math.min(obj.domain.yMin, obj.domain.yMax),
      vMax: Math.max(obj.domain.yMin, obj.domain.yMax)
    },
    polylineHV: null
  });
  return true;
}

export function tryAppendExplicitCompiledCurve(
  graphs: RenderableGraph[],
  obj: GraphObject,
  axisPair: AxisPairSpec,
  effectiveDependent: string | null,
  numericSource: string
): boolean {
  const dependentVar =
    obj.kind === "surface" && effectiveDependent ? effectiveDependent : axisPair.vertical;
  const dependentPattern = new RegExp(`^${escapeRegExp(dependentVar)}\\s*=\\s*`, "i");
  const cleanExpr = numericSource.replace(dependentPattern, "").trim();
  const compiled = tryCompileMathExpression(cleanExpr);
  if (!compiled) {
    return false;
  }
  graphs.push({
    id: obj.id,
    color: obj.color,
    verticalLineValue: null,
    horizontalLineValue: null,
    polylineHV: null,
    implicitEvaluate: null,
    hatchDomain: null,
    evaluate: (horizontalValue: number) => {
      try {
        const scope: Record<string, number> = {
          x: 0,
          y: 0,
          z: 0,
          t: horizontalValue,
          pi: Math.PI,
          e: Math.E
        };
        scope[axisPair.horizontal] = horizontalValue;
        const result = compiled.evaluate(scope);
        const numeric = typeof result === "number" ? result : Number(result);
        return Number.isFinite(numeric) ? numeric : null;
      } catch {
        return null;
      }
    }
  });
  return true;
}
