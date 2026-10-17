import { computeGeometryFacts, resolveGeometrySource } from "@/lib/math/geometry/geometryAnalysis";
import { compileSurfaceExpression, getEffectiveSurfaceOrientation } from "@/lib/math/expressions/compileExpression";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { inferGraphEquation } from "@/lib/math/expressions/inferGraphEquation";
import { splitSingleMathEquality } from "@/lib/math/expressions/implicitEquation";
import { buildGeometrySlice2d } from "./graph2dCanvasGeometrySlice";
import { compileImplicitSurfaceExpression, type CompiledImplicitSurfaceExpression } from "@/lib/math/expressions/compileImplicitSurface";
import type { GraphObject, LinearTransformObject2D, SurfaceDomain } from "@vinculum/scene/types";
import type { GeometryAnalysisConfig, LinearTransformAnalysisConfig, ScalarVizConfig, StreamlineVizConfig } from "@/types/graphUi";
import {
  tryAppendExplicitCompiledCurve,
  tryAppendImplicitRenderableGraph,
  tryAppendSurfaceHatchRenderable
} from "./equationRenderableBranches";
import { escapeRegExp } from "./graph2dCanvasImplicitParse";
import { compilePlaneEquation, samplePlane } from "@/lib/math/surfaces/samplePlane";
import { buildParametricPolylineHV, buildParametricSurfaceMeshXY, buildParametricSurfaceSlice } from "./graph2dCanvasParametricPolyline";
import { buildVectorFieldArrows } from "./graph2dCanvasVectorField";
import { analyzeEigen } from "@/lib/math/linear-algebra/matrixEigen";
import { resolveLinearTransform } from "@/lib/math/linear-algebra/linearTransformResolve";
import type { AxisPairSpec, LinearTransformLayer, RenderableGraph } from "./graph2dCanvasTypes";

// Keep unchanged fields stable across color/visibility/selection updates so
// the contour renderer can reuse its cached paths instead of resampling.
const planarFields = new WeakMap<CompiledImplicitSurfaceExpression, Map<string, (x: number, y: number) => number | null>>();
type CoordinateBounds = Partial<Record<"x" | "y" | "z", readonly [number, number]>>;
function inRange(value: number, range?: readonly [number, number]): boolean {
  return !range || value >= Math.min(range[0], range[1]) && value <= Math.max(range[0], range[1]);
}
function insideBounds(coords: Record<"x" | "y" | "z", number>, bounds: CoordinateBounds): boolean {
  return inRange(coords.x, bounds.x) && inRange(coords.y, bounds.y) && inRange(coords.z, bounds.z);
}
function getPlanarField(compiled: CompiledImplicitSurfaceExpression, horizontal: "x" | "y" | "z" = "x", vertical: "x" | "y" | "z" = "y", bounds: CoordinateBounds = {}) {
  let fields = planarFields.get(compiled);
  if (!fields) { fields = new Map(); planarFields.set(compiled, fields); }
  const key = horizontal + vertical + JSON.stringify(bounds);
  let field = fields.get(key);
  if (!field) {
    field = Object.assign((h: number, v: number) => {
      const coords = { x: 0, y: 0, z: 0, [horizontal]: h, [vertical]: v };
      if (!insideBounds(coords, bounds)) return null;
      const value = compiled.evaluator(coords.x, coords.y, coords.z);
      return Number.isFinite(value) ? value : null;
    }, { sampleXYGrid: compiled.samplePlaneGrid ? (hMin: number, hMax: number, columns: number, vMin: number, vMax: number, rows: number) => {
      const values = compiled.samplePlaneGrid!(horizontal, vertical, hMin, hMax, columns, vMin, vMax, rows);
      if (Object.keys(bounds).length) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const fixedAxis = horizontal !== "x" && vertical !== "x" ? "x" : horizontal !== "y" && vertical !== "y" ? "y" : "z";
        if (!inRange(0, bounds[fixedAxis]) || !inRange(hMin + (hMax - hMin) * col / (columns - 1), bounds[horizontal]) || !inRange(vMin + (vMax - vMin) * row / (rows - 1), bounds[vertical])) values[row * columns + col] = NaN;
      }
      return values;
    } : undefined });
    if (fields.size >= 16) fields.delete(fields.keys().next().value!);
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
      const polylineHV = buildParametricPolylineHV(obj, axisPair.horizontal, axisPair.vertical, params);
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
      const d = obj.domain;
      graphs.push({ id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null,
        evaluate: null, implicitEvaluate: getPlanarField(compiled, axisPair.horizontal, axisPair.vertical, { x: [d.xMin, d.xMax], y: [d.yMin, d.yMax], z: [d.zMin, d.zMax] }), hatchDomain: null, polylineHV: null });
      continue;
    }
    if (obj.kind === "parametricSurface") {
      if (obj.dimension === "2d" && axisPair.horizontal === "x" && axisPair.vertical === "y") {
        const meshXY = buildParametricSurfaceMeshXY(obj, params);
        if (meshXY) graphs.push({ id: obj.id, color: obj.color, meshXY,
          verticalLineValue: null, horizontalLineValue: null, evaluate: null,
          implicitEvaluate: null, hatchDomain: null, polylineHV: null });
      } else if (obj.dimension !== "2d") {
        const slice = buildParametricSurfaceSlice(obj, axisPair.horizontal, axisPair.vertical, params);
        const base = { id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null, evaluate: null, implicitEvaluate: null, hatchDomain: null, polylineHV: null };
        if (slice?.points.length) graphs.push({ ...base, polylineHV: { points: slice.points, connectedSegments: slice.connectedSegments } });
        if (slice?.areaIndices.length) graphs.push({ ...base, meshXY: { points: slice.areaPoints, indices: slice.areaIndices, wireframe: obj.appearance.wireframe } });
        if (slice?.contacts.length) graphs.push({ ...base, analysisPoints: slice.contacts });
      }
      continue;
    }

    if (obj.kind === "plane") {
      const compiled = compilePlaneEquation(obj.equation, params);
      if (!compiled.coefficients) continue;
      const { positions } = samplePlane(compiled.coefficients, obj.size);
      const indexFor = (axis: "x" | "y" | "z") => axis === "x" ? 0 : axis === "y" ? 1 : 2;
      const hi = indexFor(axisPair.horizontal), vi = indexFor(axisPair.vertical);
      const fixed = 3 - hi - vi;
      const epsilon = 1e-6 * Math.max(1, ...positions.map(Math.abs));
      const points: number[][] = [];
      const add = (h: number, v: number) => { if (!points.some(point => Math.hypot(point[0] - h, point[1] - v) <= epsilon)) points.push([h, v]); };
      const coplanar = [0, 1, 2, 3].every(i => Math.abs(positions[i * 3 + fixed]) <= epsilon);
      for (let i = 0; i < 4; i++) {
        const a = i * 3, b = ((i + 1) % 4) * 3;
        const start = positions[a + fixed], end = positions[b + fixed];
        if (Math.abs(start) <= epsilon) add(positions[a + hi], positions[a + vi]);
        if (start * end < 0) {
          const t = start / (start - end);
          add(positions[a + hi] + t * (positions[b + hi] - positions[a + hi]), positions[a + vi] + t * (positions[b + vi] - positions[a + vi]));
        }
      }
      if (coplanar && points.length) points.push(points[0]);
      if (points.length < 2) continue;
      graphs.push({ id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null, evaluate: null, implicitEvaluate: null, hatchDomain: null,
        polylineHV: { points: Float64Array.from(points.flat()), connectedSegments: new Uint8Array(points.length - 1).fill(1) } });
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

    // Spatial primitives use true coordinate-plane intersections, not flattened coordinates.
    if (
      obj.kind === "point" ||
      obj.kind === "vector" ||
      obj.kind === "line" ||
      obj.kind === "ray" ||
      obj.kind === "segment"
    ) {
      const slice = buildGeometrySlice2d(obj, axisPair, params);
      if (slice) graphs.push(slice);
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
      const sidewaysCases = inferred.explicitAxis === "x";
      graphs.push({ id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null,
        hasDiscontinuities: compiled.evaluator.hasDiscontinuities,
        swapAxes: sidewaysCases,
        evaluate: explicitY || sidewaysCases ? (t) => { const value = sidewaysCases ? field(0, t) : field(t, 0); return value === null ? null : -value; } : null,
        implicitEvaluate: explicitY || sidewaysCases ? null : field, hatchDomain: null, polylineHV: null });
      continue;
    }

    if (obj.kind === "surface" && (getEffectiveSurfaceOrientation(obj.equation, obj.orientation).body !== obj.equation.trim() || !splitSingleMathEquality(obj.equation))) {
      const compiled = compileSurfaceExpression(obj.equation, obj.orientation, params);
      if (compiled.error) continue;
      const dependent = compiled.effectiveOrientation;
      const inputs = dependent === "x" ? ["y", "z"] as const : dependent === "y" ? ["x", "z"] as const : ["x", "y"] as const;
      const followsView = obj.autoDomain ?? Boolean(obj.autoExpression);
      const bounds: CoordinateBounds = followsView ? {} : { [inputs[0]]: [obj.domain.xMin, obj.domain.xMax], [inputs[1]]: [obj.domain.yMin, obj.domain.yMax] };
      const base = { id: obj.id, color: obj.color, verticalLineValue: null, horizontalLineValue: null, hatchDomain: null, polylineHV: null, hasDiscontinuities: compiled.evaluator.hasDiscontinuities };
      if (dependent === axisPair.horizontal || dependent === axisPair.vertical) {
        const inputAxis = dependent === axisPair.horizontal ? axisPair.vertical : axisPair.horizontal;
        graphs.push({ ...base, swapAxes: dependent === axisPair.horizontal, implicitEvaluate: null, evaluate: (t) => {
          const coords = { x: 0, y: 0, z: 0, [inputAxis]: t };
          if (!insideBounds(coords, bounds)) return null;
          const value = compiled.evaluator(coords[inputs[0]], coords[inputs[1]]);
          return Number.isFinite(value) ? value : null;
        } });
      } else {
        const body = getEffectiveSurfaceOrientation(obj.equation, obj.orientation).body;
        if (compiled.evaluator.isConstant && compiled.evaluator(0, 0) === 0) {
          graphs.push({ ...base, evaluate: null, implicitEvaluate: null, coplanarSurface: followsView, hatchDomain: followsView ? null : { hMin: Math.min(obj.domain.xMin, obj.domain.xMax), hMax: Math.max(obj.domain.xMin, obj.domain.xMax), vMin: Math.min(obj.domain.yMin, obj.domain.yMax), vMax: Math.max(obj.domain.yMin, obj.domain.yMax) } });
          continue;
        }
        const relation = compileImplicitSurfaceExpression(`${dependent}=(${body})`, params);
        if (!relation.error) graphs.push({ ...base, evaluate: null, implicitEvaluate: getPlanarField(relation, axisPair.horizontal, axisPair.vertical, bounds) });
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

    if (tryAppendImplicitRenderableGraph(graphs, obj, axisPair, numericSource, params)) {
      continue;
    }

    if (tryAppendSurfaceHatchRenderable(graphs, obj, axisPair, effectiveDependent)) {
      continue;
    }

    tryAppendExplicitCompiledCurve(graphs, obj, axisPair, effectiveDependent, numericSource, params);
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
  const orientation = getEffectiveSurfaceOrientation(obj.equation, obj.orientation).effectiveOrientation;
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


/** XY analysis markers share the exact cached solution used by the Inspector. */
export function buildPlanarIntersectionGraphs(objects: GraphObject[], configs: Record<string, GeometryAnalysisConfig>, params: Record<string, number>, domain: SurfaceDomain): RenderableGraph[] {
  const graphs: RenderableGraph[] = [];
  for (const [id, config] of Object.entries(configs)) {
    const a = objects.find(object => object.id === id), b = objects.find(object => object.id === config.secondaryId);
    if (!config.showOverlay || a?.kind !== "implicitCurve" || b?.kind !== "implicitCurve" || a.extendTo3D || b.extendTo3D || !a.visible || !b.visible) continue;
    const facts = computeGeometryFacts(resolveGeometrySource(a, params, domain), resolveGeometrySource(b, params, domain));
    if (facts.pair !== "curve-curve" || facts.intersection.status !== "points") continue;
    graphs.push({ id: `intersection:${id}`, color: "#f59e0b", analysisPoints: facts.intersection.points,
      verticalLineValue: null, horizontalLineValue: null, evaluate: null, implicitEvaluate: null, hatchDomain: null, polylineHV: null });
  }
  return graphs;
}
