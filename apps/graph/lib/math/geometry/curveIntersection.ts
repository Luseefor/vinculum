import type { ImplicitCurveObject, SurfaceDomain } from "@vinculum/scene/types";
import { defaultSurfaceDomain } from "@vinculum/scene/defaults";
import type { SurfaceIntersectionResult } from "./surfaceIntersection";
import { inferGraphEquation } from "../expressions/inferGraphEquation";
import { compileImplicitSurfaceExpression } from "../expressions/compileImplicitSurface";
import { sampleScalarGrid } from "../fields/scalarFieldSample";
import { extractContours } from "../surfaces/marchingSquares";

const cache = new Map<string, SurfaceIntersectionResult>();

/** Bounded contour candidates refined against both original equations. */
export function computeCurveIntersection(a: ImplicitCurveObject, b: ImplicitCurveObject, params: Record<string, number>, domain: SurfaceDomain = defaultSurfaceDomain): SurfaceIntersectionResult {
  const key = JSON.stringify([a.equation, b.equation, Object.entries(params).sort(), domain]);
  const cached = cache.get(key);
  if (cached) return cached;
  const equations: [string, string] = [a.equation, b.equation];
  let result: SurfaceIntersectionResult;
  try {
    const inferred = [a, b].map(object => inferGraphEquation(object.equation, params));
    if (inferred[0].ok && inferred[1].ok && inferred[0].relation.replace(/\s/g, "") === inferred[1].relation.replace(/\s/g, "")) {
      const overlap: SurfaceIntersectionResult = { status: "overlap", equations, segments: [], points: [], message: "Both objects define the same planar curve." };
      cache.set(key, overlap);
      if (cache.size > 16) cache.delete(cache.keys().next().value!);
      return overlap;
    }
    const evaluators = inferred.map(value => {
      if (!value.ok || value.dimension !== "2d") throw new Error(value.ok ? "Select two planar equations." : value.error);
      const compiled = compileImplicitSurfaceExpression(value.relation, params);
      if (compiled.error) throw new Error(compiled.error);
      return (x: number, y: number) => compiled.evaluator(x, y, 0);
    });
    const [f, g] = evaluators;
    const gridDomain = { uMin: domain.xMin, uMax: domain.xMax, vMin: domain.yMin, vMax: domain.yMax };
    const sampled = sampleScalarGrid(f, gridDomain, 128);
    const contours = extractContours(sampled, gridDomain, [0]);
    if (contours.status === "budget-exceeded" || contours.segmentCount > 12000) throw new Error("Intersection exceeded the sampling budget. Zoom in or simplify the equations.");
    const points: SurfaceIntersectionResult["points"] = [];
    const span = Math.max(domain.xMax - domain.xMin, domain.yMax - domain.yMin);
    const h = Math.max(1e-7, span * 1e-6);
    const refine = (initialX: number, initialY: number) => {
      let x = initialX, y = initialY;
      for (let iteration = 0; iteration < 40; iteration++) {
        const fx = f(x, y), gx = g(x, y);
        if (!Number.isFinite(fx) || !Number.isFinite(gx)) return;
        if (Math.max(Math.abs(fx), Math.abs(gx)) < 1e-12) break;
        const fxX = (f(x + h, y) - f(x - h, y)) / (2 * h), fxY = (f(x, y + h) - f(x, y - h)) / (2 * h);
        const gxX = (g(x + h, y) - g(x - h, y)) / (2 * h), gxY = (g(x, y + h) - g(x, y - h)) / (2 * h);
        const determinant = fxX * gxY - fxY * gxX;
        if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-14) break;
        const dx = (fx * gxY - gx * fxY) / determinant, dy = (gx * fxX - fx * gxX) / determinant;
        const damping = Math.min(1, span / (16 * Math.max(Math.abs(dx), Math.abs(dy))));
        x -= dx * damping; y -= dy * damping;
        if (x < domain.xMin - h || x > domain.xMax + h || y < domain.yMin - h || y > domain.yMax + h) return;
      }
      if (![x, y, f(x, y), g(x, y)].every(Number.isFinite) || Math.abs(f(x, y)) > 1e-7 || Math.abs(g(x, y)) > 1e-7) return;
      if (!points.some(point => Math.hypot(point.x - x, point.y - y) < Math.max(1e-5, span * 1e-6))) points.push({ x, y, z: 0 });
      if (points.length > 512) throw new Error("Too many intersection points. Zoom in to analyze a smaller region.");
    };
    let coincident = 0;
    if (contours.status === "ok") {
      for (let index = 0; index < contours.segmentCount; index++) {
        const [x0, y0, x1, y1] = Array.from(contours.segments.subarray(index * 4, index * 4 + 4));
        const first = g(x0, y0), last = g(x1, y1);
        if (Math.abs(first) < 1e-8 && Math.abs(last) < 1e-8) coincident++;
        if (first * last <= 0 || Math.min(Math.abs(first), Math.abs(last)) < span / 64) refine((x0 + x1) / 2, (y0 + y1) / 2);
      }
    }
    const overlap = coincident > 2 && coincident > contours.segmentCount * .1;
    result = { status: overlap ? "overlap" : points.length ? "points" : "empty", equations, segments: [], points: overlap ? [] : points,
      message: overlap ? "The sampled curves share a portion; there is no unique set of intersection points."
        : points.length ? "Intersection points satisfy both equations numerically within the sampled view."
          : "No intersection found in the sampled view. Small or tangent intersections may be missed; adjust the view." };
  } catch (error) {
    result = { status: "unresolved", equations, points: [], segments: [], message: error instanceof Error ? error.message : "Check both equations." };
  }
  cache.set(key, result);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return result;
}
