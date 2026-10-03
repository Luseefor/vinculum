import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { inferGraphEquation } from "@/lib/math/inferGraphEquation";
import { compileImplicitSurfaceExpression, type CompiledImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import type { GraphObject, LinearTransformObject2D } from "@vinculum/scene/types";
import type { LinearTransformAnalysisConfig, ScalarVizConfig, StreamlineVizConfig } from "@/types/graphUi";
import {
  tryAppendExplicitCompiledCurve,
  tryAppendImplicitRenderableGraph,
  tryAppendSurfaceHatchRenderable
} from "./equationRenderableBranches";
import { escapeRegExp } from "./graph2dCanvasImplicitParse";
import { buildParametricPolylineHV } from "./graph2dCanvasParametricPolyline";
import { buildVectorFieldArrows } from "./graph2dCanvasVectorField";
import { analyzeEigen } from "@/lib/math/matrixEigen";
import { resolveLinearTransform } from "@/lib/math/linearTransformResolve";
import type { AxisPairSpec, LinearTransformLayer, RenderableGraph } from "./graph2dCanvasTypes";

// Keep unchanged fields stable across color/visibility/selection updates so
// the contour renderer can reuse its cached paths instead of resampling.
const planarFields = new WeakMap<CompiledImplicitSurfaceExpression, Map<string, (x: number, y: number) => number | null>>();
function getPlanarField(compiled: CompiledImplicitSurfaceExpression, horizontal: "x" | "y" | "z" = "x", vertical: "x" | "y" | "z" = "y") {
  let fields = planarFields.get(compiled);
  if (!fields) { fields = new Map(); planarFields.set(compiled, fields); }
  const key = horizontal + vertical;
  let field = fields.get(key);
  if (!field) {
    field = Object.assign((h: number, v: number) => {
      const coords = { x: 0, y: 0, z: 0, [horizontal]: h, [vertical]: v };
      const value = compiled.evaluator(coords.x, coords.y, coords.z);
      return Number.isFinite(value) ? value : null;
    }, { sampleXYGrid: compiled.samplePlaneGrid ? (hMin: number, hMax: number, columns: number, vMin: number, vMax: number, rows: number) => compiled.samplePlaneGrid!(horizontal, vertical, hMin, hMax, columns, vMin, vMax, rows) : undefined });
    fields.set(key, field);
  }
  return field;
}

export function buildRenderableGraphsFromScene(
  objects: GraphObject[],
  axisPair: AxisPairSpec,
  params: Record<string, number>,
  scalarViz: Record<string, ScalarVizConfig> = {},
  streamlines: Record<string, StreamlineVizConfig> = {},
  linearAnalysis: Record<string, LinearTransformAnalysisConfig> = {}
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

    // Implicit surfaces show the zero cross-section in the selected coordinate
    // plane. This is an intersection, never a projection of the 3D mesh.
    if (obj.kind === "implicitSurface") {
      if (!obj.equation.trim()) continue;
      const compiled = compileImplicitSurfaceExpression(obj.equation, params);
      if (compiled.error) continue;
      graphs.push({ id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null,
        evaluate: null, implicitEvaluate: getPlanarField(compiled, axisPair.horizontal, axisPair.vertical), hatchDomain: null, polylineHV: null });
      continue;
    }
    // Parametric surfaces have no canonical coordinate-plane intersection yet.
    if (obj.kind === "parametricSurface") continue;

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
        // S24: streamline reference for live enabled configs (any pair:
        // points integrate in canonical (x, y) and project per pair).
        const streamlineAttachment = streamlineAttachmentFor(obj, params, streamlines);
        if (streamlineAttachment) {
          graphs.push({
            id: obj.id,
            color: obj.color,
            verticalLineValue: null,
            horizontalLineValue: null,
            evaluate: null,
            implicitEvaluate: null,
            hatchDomain: null,
            polylineHV: null,
            streamlines: streamlineAttachment
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

    // S26 2D-canvas decision (PART 50): spatial primitives render in the
    // shared Three Geometry system only — no ambiguous 2D projection is
    // invented for Canvas2D. The Math Lab object list still
    // contains/selects/edits them; they simply produce no 2D renderable.
    if (
      obj.kind === "point" ||
      obj.kind === "vector" ||
      obj.kind === "line" ||
      obj.kind === "ray" ||
      obj.kind === "segment"
    ) {
      continue;
    }

    // S28: 2D linear transformations resolve synchronously (microseconds)
    // and draw basis + unit square natively in R². XY pair only (PART 14):
    // matrix rows are canonical (x,y), never reinterpreted per pair.
    // 3D transforms skip here — shared Three scene only.
    if (obj.kind === "linearTransform") {
      if (obj.dimension !== "2d") {
        continue;
      }
      const attachment = linearTransformAttachmentFor(obj, axisPair, params, linearAnalysis);
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
          linearTransform: attachment
        });
      }
      continue;
    }

    if (obj.kind === "implicitCurve") {
      if (axisPair.horizontal !== "x" || axisPair.vertical !== "y" || !obj.equation.trim()) continue;
      const inferred = inferGraphEquation(obj.equation, params);
      if (!inferred.ok || inferred.dimension !== "2d") continue;
      const compiled = compileImplicitSurfaceExpression(inferred.relation, params);
      if (compiled.error) continue;
      const field = getPlanarField(compiled);
      // Ordinary y=f(x) graphs reuse the explicit curve sampler, including
      // its discontinuity handling. General relations remain zero contours.
      const explicitY = inferred.explicitAxis === "y";
      graphs.push({ id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null,
        evaluate: explicitY ? (x) => { const value = field(x, 0); return value === null ? null : -value; } : null,
        implicitEvaluate: explicitY ? null : field, hatchDomain: null, polylineHV: null });
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

// S24 streamline attach gate: 2D vector field + enabled live config.
// Pair-independent (canonical (x, y) integration projects to every pair).
function streamlineAttachmentFor(
  obj: Extract<GraphObject, { kind: "vectorField"; dimension: "2d" }>,
  params: Record<string, number>,
  configs: Record<string, StreamlineVizConfig>
): { sourceId: string } | null {
  const config = configs[obj.id];
  if (!config || !config.enabled) {
    return null;
  }
  if (vectorCalculusSourceIdentity(obj, Object.keys(params)) !== config.structure) {
    return null;
  }
  return { sourceId: obj.id };
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

// S28 linearTransform attach gate: 2D dimension + XY pair only (PART 14 —
// matrix rows are canonical (x,y), never reinterpreted per pair) + live
// resolution. 3D transforms skip here (shared Three scene only).
function linearTransformAttachmentFor(
  obj: LinearTransformObject2D,
  axisPair: AxisPairSpec,
  params: Record<string, number>,
  linearAnalysis: Record<string, LinearTransformAnalysisConfig>
): LinearTransformLayer | null {
  if (axisPair.horizontal !== "x" || axisPair.vertical !== "y") {
    return null;
  }
  const resolved = resolveLinearTransform(
    {
      dimension: "2d",
      entries: { m11: obj.m11, m12: obj.m12, m21: obj.m21, m22: obj.m22 }
    },
    params
  );
  if (resolved.status !== "ok") {
    return null;
  }
  const showEigen = linearAnalysis[obj.id]?.showEigen ?? false;
  const eigenDirections: Array<[number, number]> = [];
  if (showEigen) {
    const analysis = analyzeEigen([...resolved.matrix], 2);
    for (const entry of analysis.entries) {
      if (entry.kind === "real" && entry.vector.length === 2) {
        eigenDirections.push([entry.vector[0] as number, entry.vector[1] as number]);
      }
    }
  }
  return {
    dimension: 2,
    matrix: [...resolved.matrix] as [number, number, number, number],
    eigenDirections,
    showEigen
  };
}
