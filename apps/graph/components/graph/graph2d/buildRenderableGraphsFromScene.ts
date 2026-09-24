import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import type { GraphObject } from "@vinculum/scene/types";
import type { ScalarVizConfig } from "@/types/graphUi";
import {
  tryAppendExplicitCompiledCurve,
  tryAppendImplicitRenderableGraph,
  tryAppendSurfaceHatchRenderable
} from "./equationRenderableBranches";
import { escapeRegExp } from "./graph2dCanvasImplicitParse";
import { buildParametricPolylineHV } from "./graph2dCanvasParametricPolyline";
import { buildVectorFieldArrows } from "./graph2dCanvasVectorField";
import type { AxisPairSpec, RenderableGraph } from "./graph2dCanvasTypes";

export function buildRenderableGraphsFromScene(
  objects: GraphObject[],
  axisPair: AxisPairSpec,
  params: Record<string, number>,
  scalarViz: Record<string, ScalarVizConfig> = {}
): RenderableGraph[] {
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

    // S17: parametric surfaces have no single-equation axis-pair projection,
    // so they render in 3D views only. Skipping here (before `obj.equation`
    // access, which this kind does not define) keeps 2D rendering safe;
    // export2dSvg warns per skipped visible object so SVG export stays honest.
    // S18: true implicit 3D surfaces follow the same policy — no fake 2D
    // interpretation of the volumetric mesh.
    if (obj.kind === "parametricSurface" || obj.kind === "implicitSurface") {
      continue;
    }

    // S20: 2D vector fields sample synchronously (bounded, microseconds)
    // and draw as Canvas2D glyphs. 3D fields skip here (PART 10): they
    // render in the shared Three scene only, never as a fake z=0 overlay.
    if (obj.kind === "vectorField") {
      if (obj.dimension === "2d") {
        const arrows = buildVectorFieldArrows(obj, axisPair, params);
        if (arrows) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: null,
            horizontalLineValue: null,
            evaluate: null,
            implicitEvaluate: null,
            hatchDomain: null,
            polylineHV: null,
            vectorField: arrows
          });
        }
      }
      continue;
    }

    // S23: scalar-visualization reference for explicit scalar sources.
    // Pushed as its own entry (heat pass + overlay pass resolve the cached
    // worker result by sourceId), ahead of the source curve so derived
    // layers paint beneath it. Constant equations keep their heat: the
    // attachment does not depend on curve compilation.
    if (obj.kind === "surface") {
      const attachment = scalarAttachmentFor(obj, axisPair, params, scalarViz);
      if (attachment) {
        graphs.push({
          id: obj.id,
          color: obj.color,
          verticalLineValue: null,
          horizontalLineValue: null,
          evaluate: null,
          implicitEvaluate: null,
          hatchDomain: null,
          polylineHV: null,
          scalarField: attachment
        });
      }
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

// S23 scalar attach gate: explicit surface + any 2D viz enabled + live
// config structure + canvas pair equal to the source independent
// variables (a z=f(x,y) heat lives in the xy plane; rendering it under
// xz/yz would be view-dependent mathematics, so it stays hidden there).
function scalarAttachmentFor(
  obj: Extract<GraphObject, { kind: "surface" }>,
  axisPair: AxisPairSpec,
  params: Record<string, number>,
  scalarViz: Record<string, ScalarVizConfig>
): { sourceId: string; domain: { uMin: number; uMax: number; vMin: number; vMax: number } } | null {
  const config = scalarViz[obj.id];
  if (!config || (!config.showHeatmap && !config.showContours && !config.showGradient)) {
    return null;
  }
  if (scalarVizMathIdentity(obj, Object.keys(params)) !== config.structure) {
    return null;
  }
  const orientation = obj.orientation ?? "z";
  const pairMatches =
    orientation === "x"
      ? axisPair.horizontal === "y" && axisPair.vertical === "z"
      : orientation === "y"
        ? axisPair.horizontal === "x" && axisPair.vertical === "z"
        : axisPair.horizontal === "x" && axisPair.vertical === "y";
  if (!pairMatches) {
    return null;
  }
  return {
    sourceId: obj.id,
    domain: { uMin: obj.domain.xMin, uMax: obj.domain.xMax, vMin: obj.domain.yMin, vMax: obj.domain.yMax }
  };
}
