import type { ImplicitCurveObject, SurfaceDomain } from "@vinculum/scene/types";
import { inferGraphEquation } from "@/lib/math/expressions/inferGraphEquation";
import { sampleCurve } from "@/lib/math/curves/sampleCurve";
import { compileImplicitSurfaceExpression } from "@/lib/math/expressions/compileImplicitSurface";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { extractContours } from "@/lib/math/surfaces/marchingSquares";
import type { SampledScalarGrid } from "@/lib/math/fields/scalarFieldSample";
import { mathToWorld3D } from "@/lib/math/geometry/coordinates";
import { createWideStroke } from "./graphWideStroke";

/** Keep a 2D relation on math z=0, using the canonical bounded contour extractor. */
export type DisplayImplicitCurve = ImplicitCurveObject & { displayDomain?: SurfaceDomain };
export function buildImplicitCurve(object: DisplayImplicitCurve) {
  if (!object.equation.trim()) return null;
  const params = getEditorParameterScope();
  const inferred = inferGraphEquation(object.equation, params);
  if (!inferred.ok || inferred.dimension !== "2d") return null;
  const compiled = compileImplicitSurfaceExpression(inferred.relation, params);
  if (compiled.error || !compiled.sampleXYGrid) return null;
  const bounds = object.displayDomain ?? { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
  if (inferred.explicitAxis === "x" || inferred.explicitAxis === "y") {
    const axis = inferred.explicitAxis;
    const evaluator = Object.assign((t: number): [number, number, number] => {
      const x = axis === "x" ? -compiled.evaluator(0, t, 0) : t;
      const y = axis === "y" ? -compiled.evaluator(t, 0, 0) : t;
      return [x, y, 0];
    }, { hasDiscontinuities: compiled.evaluator.hasDiscontinuities });
    const sampled = sampleCurve(evaluator, { tMin: axis === "x" ? bounds.yMin : bounds.xMin, tMax: axis === "x" ? bounds.yMax : bounds.xMax, samples: 2049 });
    const positions: number[] = [];
    for (let index=0; index<sampled.connectedSegments.length; index++) {
      if (sampled.connectedSegments[index] !== 1) continue;
      positions.push(...sampled.positions.subarray(index*3,index*3+6));
    }
    if (!positions.length) return null;
    const stroke = createWideStroke(positions, object.color);
    stroke.userData.vinculumId = object.id;
    return stroke;
  }
  const domain = { uMin: bounds.xMin, uMax: bounds.xMax, vMin: bounds.yMin, vMax: bounds.yMax };
  const width = 257;
  const samples = compiled.sampleXYGrid(domain.uMin, domain.uMax, width, domain.vMin, domain.vMax, width);
  const values = new Float32Array(samples);
  const valid = new Uint8Array(samples.length);
  let min = Infinity, max = -Infinity, validCount = 0;
  for (let index = 0; index < values.length; index++) {
    if (!Number.isFinite(values[index])) continue;
    valid[index] = 1; validCount++;
    min = Math.min(min, values[index]); max = Math.max(max, values[index]);
  }
  const grid: SampledScalarGrid = { values, valid, width, height: width, min, max, validCount, totalSamples: values.length };
  const contours = extractContours(grid, domain, [0], (x, y) => compiled.evaluator(x, y, 0));
  if (contours.status !== "ok" || !contours.segmentCount) return null;
  const positions = new Float32Array(contours.segmentCount * 6);
  for (let index = 0; index < contours.segmentCount * 2; index++) {
    const world = mathToWorld3D({ x: contours.segments[index * 2], y: contours.segments[index * 2 + 1], z: 0 });
    positions.set([world.x, world.y, world.z], index * 3);
  }
  const stroke = createWideStroke(positions, object.color);
  stroke.userData.vinculumId = object.id;
  return stroke;
}
