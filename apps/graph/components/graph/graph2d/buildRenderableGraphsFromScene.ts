import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";
import type { GraphObject } from "@vinculum/scene/types";
import {
  tryAppendExplicitCompiledCurve,
  tryAppendImplicitRenderableGraph,
  tryAppendSurfaceHatchRenderable
} from "./equationRenderableBranches";
import { escapeRegExp } from "./graph2dCanvasImplicitParse";
import { buildParametricPolylineHV } from "./graph2dCanvasParametricPolyline";
import type { AxisPairSpec, RenderableGraph } from "./graph2dCanvasTypes";

export function buildRenderableGraphsFromScene(objects: GraphObject[], axisPair: AxisPairSpec): RenderableGraph[] {
  const graphs: RenderableGraph[] = [];

  for (const obj of objects) {
    if (!obj.visible) {
      continue;
    }

    if (obj.kind === "parametricCurve") {
      const polylineHV = buildParametricPolylineHV(obj, axisPair.horizontal, axisPair.vertical);
      if (polylineHV) {
        graphs.push({
          id: obj.id,
          color: obj.color,
          verticalLineValue: null,
          horizontalLineValue: null,
          evaluate: null,
          implicitEvaluate: null,
          hatchDomain: null,
          polylineHV
        });
      }
      continue;
    }

    const expr = obj.equation;
    const trimmed = expr.trim();
    if (!trimmed) {
      continue;
    }

    const surfaceEffective =
      obj.kind === "surface" ? getEffectiveSurfaceOrientation(expr, obj.orientation || "z") : null;
    const effectiveDependent = surfaceEffective?.effectiveOrientation ?? null;
    const surfaceBody = surfaceEffective?.body.trim() ?? "";

    const horizontal = escapeRegExp(axisPair.horizontal);
    const vertical = escapeRegExp(axisPair.vertical);

    const verticalLineMatch = trimmed.match(new RegExp(`^${horizontal}\\s*=\\s*([\\d.eE+-]+)$`, "i"));
    if (verticalLineMatch) {
      const value = Number(verticalLineMatch[1]);
      if (Number.isFinite(value)) {
        graphs.push({
          id: obj.id,
          color: obj.color,
          verticalLineValue: value,
          horizontalLineValue: null,
          evaluate: null,
          implicitEvaluate: null,
          hatchDomain: null,
          polylineHV: null
        });
      }
      continue;
    }

    const horizontalLineMatch = trimmed.match(new RegExp(`^${vertical}\\s*=\\s*([\\d.eE+-]+)$`, "i"));
    if (horizontalLineMatch) {
      const value = Number(horizontalLineMatch[1]);
      if (Number.isFinite(value)) {
        graphs.push({
          id: obj.id,
          color: obj.color,
          verticalLineValue: null,
          horizontalLineValue: value,
          evaluate: null,
          implicitEvaluate: null,
          hatchDomain: null,
          polylineHV: null
        });
      }
      continue;
    }

    const numericSource = obj.kind === "surface" ? surfaceBody || trimmed : trimmed;
    const maybeDirectValue = Number(numericSource);
    if (Number.isFinite(maybeDirectValue)) {
      if (obj.kind === "surface" && effectiveDependent) {
        if (effectiveDependent === axisPair.horizontal) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: maybeDirectValue,
            horizontalLineValue: null,
            evaluate: null,
            implicitEvaluate: null,
            hatchDomain: null,
            polylineHV: null
          });
          continue;
        }
        if (effectiveDependent === axisPair.vertical) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: null,
            horizontalLineValue: maybeDirectValue,
            evaluate: null,
            implicitEvaluate: null,
            hatchDomain: null,
            polylineHV: null
          });
          continue;
        }
        continue;
      }

      graphs.push({
        id: obj.id,
        color: obj.color,
        verticalLineValue: null,
        horizontalLineValue: maybeDirectValue,
        evaluate: null,
        implicitEvaluate: null,
        hatchDomain: null,
        polylineHV: null
      });
      continue;
    }

    if (tryAppendImplicitRenderableGraph(graphs, obj, axisPair, numericSource)) {
      continue;
    }

    if (tryAppendSurfaceHatchRenderable(graphs, obj, axisPair, effectiveDependent)) {
      continue;
    }

    tryAppendExplicitCompiledCurve(graphs, obj, axisPair, effectiveDependent, numericSource);
  }

  return graphs;
}
