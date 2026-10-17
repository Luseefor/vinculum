import type { GraphObject } from "@vinculum/scene/types";
import { resolveGeometrySource } from "@/lib/math/geometry/geometryAnalysis";
import { intersectLinearPlane, linearFromLine, linearFromRay, linearFromSegment } from "@/lib/math/geometry/geometryRelations";
import type { MathPoint3 } from "@/lib/math/geometry/coordinates";
import type { AxisPairSpec, RenderableGraph } from "./graph2dCanvasTypes";

/** True intersections with the selected plane, including isolated crossing points. */
export function buildGeometrySlice2d(object: GraphObject, axes: AxisPairSpec, params: Record<string, number>): RenderableGraph | null {
  const source = resolveGeometrySource(object, params);
  const fixed = axes.horizontal !== "x" && axes.vertical !== "x" ? "x" : axes.horizontal !== "y" && axes.vertical !== "y" ? "y" : "z";
  const base: RenderableGraph = { id: object.id, color: object.color, verticalLineValue: null, horizontalLineValue: null, evaluate: null, implicitEvaluate: null, hatchDomain: null, polylineHV: null };
  const project = (point: MathPoint3) => ({ x: point[axes.horizontal], y: point[axes.vertical] });
  const pointGraph = (point: MathPoint3) => ({ ...base, analysisPoints: [project(point)] });
  if (source.kind === "point") return Math.abs(source.point[fixed]) <= 1e-9 ? pointGraph(source.point) : null;
  const segment = source.kind === "segment" ? source.segment : source.kind === "vector"
    ? { start: source.anchored.origin, end: { x: source.anchored.origin.x + source.anchored.vector.x, y: source.anchored.origin.y + source.anchored.vector.y, z: source.anchored.origin.z + source.anchored.vector.z } } : null;
  const linear = source.kind === "line" ? linearFromLine(source.line) : source.kind === "ray" ? linearFromRay(source.ray) : segment ? linearFromSegment(segment) : null;
  if (!linear) return segment && Math.abs(segment.start[fixed]) <= 1e-9 ? pointGraph(segment.start) : null;
  const hit = intersectLinearPlane(linear, { normal: { x: 0, y: 0, z: 0, [fixed]: 1 }, constant: 0 });
  if (hit?.kind === "point") return pointGraph(hit.point);
  if (hit?.kind !== "contained") return null;
  if (segment) {
    const a = project(segment.start), b = project(segment.end);
    if (source.kind === "vector") {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) return pointGraph(segment.start);
      return { ...base, vectorField: { bases: new Float64Array([a.x, a.y]), directions: new Float64Array([(b.x - a.x) / length, (b.y - a.y) / length]), magnitudes: new Float32Array([length]), count: 1, maxMagnitude: length, cell: length, scale: 1, normalize: true } };
    }
    return { ...base, polylineHV: { points: new Float64Array([a.x, a.y, b.x, b.y]), connectedSegments: new Uint8Array([1]) } };
  }
  const a = project(linear.origin), dx = linear.direction[axes.horizontal], dy = linear.direction[axes.vertical];
  return { ...base, implicitEvaluate: (x, y) => {
    const parameter = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy);
    return parameter < linear.tMin || parameter > linear.tMax ? null : dx * (y - a.y) - dy * (x - a.x);
  } };
}
