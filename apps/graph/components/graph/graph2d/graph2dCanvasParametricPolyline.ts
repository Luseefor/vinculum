import { computeParametricSurfaceData } from "@/lib/math/surfaces/computeParametricSurfaceData";
import type { ParametricSurfaceObject } from "@vinculum/scene/types";
import type { RenderableGraph } from "./graph2dCanvasTypes";
import { compileParametricCurveExpressions } from "@/lib/math/expressions/compileParametric";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { worldIndexForMathAxis } from "@/lib/math/geometry/coordinates";
import { sampleCurve } from "@/lib/math/curves/sampleCurve";
import { sliceSurfaceMesh } from "@/lib/math/geometry/surfaceIntersection";
import type { ParametricCurveObject } from "@vinculum/scene/types";
import type { AxisVariable, ParametricPolyline2D } from "./graph2dCanvasTypes";

export function buildParametricPolylineHV(
  obj: ParametricCurveObject,
  horizontal: AxisVariable,
  vertical: AxisVariable,
  params: Record<string, number> = getEditorParameterScope()
): ParametricPolyline2D | null {
  if (![obj.xExpr, obj.yExpr, obj.zExpr].some((expr) => expr.trim())) {
    return null;
  }
  const compiled = compileParametricCurveExpressions(obj.xExpr, obj.yExpr, obj.zExpr, params);
  if (compiled.error) {
    return null;
  }

  let sampled;
  try {
    sampled = sampleCurve(compiled.evaluator, {
      tMin: obj.tMin,
      tMax: obj.tMax,
      samples: obj.samples,
      clampCoordinate: 10_000
    });
  } catch {
    return null;
  }

  // sampleCurve emits WORLD-frame tuples; resolve the requested MATHEMATICAL
  // axes to world tuple indices (S3 F4 fix). Single conversion, no re-mapping.
  const hi = worldIndexForMathAxis(horizontal);
  const vi = worldIndexForMathAxis(vertical);
  // S5: projects positions only; canonical connectedSegments passes through
  // below so Canvas branch topology is zoom-invariant. Behavior otherwise
  // unchanged (S3 frame mapping, sample order, no reclassification here).
  const pointCount = sampled.positions.length / 3;
  if (pointCount < 2) {
    return null;
  }

  const poly = new Float64Array(pointCount * 2);
  for (let i = 0; i < pointCount; i += 1) {
    poly[i * 2] = sampled.positions[i * 3 + hi];
    poly[i * 2 + 1] = sampled.positions[i * 3 + vi];
  }

  // Pass through canonical connectivity untouched (S5): the Canvas consumer
  // decides branches from this mask, never from pixels. Do not mutate it.
  return { points: poly, connectedSegments: sampled.connectedSegments };
}

/** Native XY region using the same bounded sampler and valid triangles as 3D. */
export function buildParametricSurfaceMeshXY(object: ParametricSurfaceObject, params: Record<string, number>): RenderableGraph["meshXY"] | null {
  const sampled = computeParametricSurfaceData({ ...object, params });
  if (sampled.status !== "ok") return null;
  const points = new Float64Array(sampled.positions.length / 3 * 2);
  for (let i = 0; i < points.length / 2; i++) {
    points[i * 2] = sampled.positions[i * 3];
    points[i * 2 + 1] = sampled.positions[i * 3 + 2];
  }
  // Give each triangle the same winding so folded maps don't erase overlap.
  const indices = sampled.indices;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 2, b = indices[i + 1] * 2, c = indices[i + 2] * 2;
    if ((points[b] - points[a]) * (points[c + 1] - points[a + 1]) - (points[b + 1] - points[a + 1]) * (points[c] - points[a]) < 0) {
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
  }
  return { points, indices, wireframe: object.appearance.wireframe };
}

const sliceCache = new Map<string, ReturnType<typeof sliceSurfaceMesh> | null>();
export function buildParametricSurfaceSlice(object: ParametricSurfaceObject, horizontal: AxisVariable, vertical: AxisVariable, params: Record<string, number>) {
  const key = JSON.stringify([object.xExpr, object.yExpr, object.zExpr, object.domain, object.resolution, horizontal, vertical, Object.entries(params).sort()]);
  if (sliceCache.has(key)) return sliceCache.get(key)!;
  const sampled = computeParametricSurfaceData({ ...object, params });
  const slice = sampled.status === "ok" ? sliceSurfaceMesh(sampled, horizontal, vertical) : null;
  sliceCache.set(key, slice);
  if (sliceCache.size > 24) sliceCache.delete(sliceCache.keys().next().value!);
  return slice;
}
