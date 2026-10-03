import type { ImplicitCurveObject } from "@vinculum/scene/types";
import { inferGraphEquation } from "@/lib/math/inferGraphEquation";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { extractContours } from "@/lib/math/marchingSquares";
import type { SampledScalarGrid } from "@/lib/math/scalarFieldSample";
import { mathToWorld3D } from "@/lib/math/coordinates";
import { createWideStroke } from "./graphWideStroke";

/** Keep a 2D relation on math z=0, using the canonical bounded contour extractor. */
export function buildImplicitCurve(object: ImplicitCurveObject) {
  if (!object.equation.trim()) return null;
  const params = getEditorParameterScope();
  const inferred = inferGraphEquation(object.equation, params);
  if (!inferred.ok || inferred.dimension !== "2d") return null;
  const compiled = compileImplicitSurfaceExpression(inferred.relation, params);
  if (compiled.error || !compiled.sampleXYGrid) return null;
  if (inferred.explicitAxis === "x" || inferred.explicitAxis === "y") {
    const axis = inferred.explicitAxis;
    const sampled = sampleCurve(t => {
      const x = axis === "x" ? -compiled.evaluator(0, t, 0) : t;
      const y = axis === "y" ? -compiled.evaluator(t, 0, 0) : t;
      return Math.abs(x) > 5 || Math.abs(y) > 5 ? [NaN, NaN, NaN] : [x, y, 0];
    }, { tMin: -5, tMax: 5, samples: 2049 });
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
  const domain = { uMin: -5, uMax: 5, vMin: -5, vMax: 5 };
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
  const contours = extractContours(grid, domain, [0]);
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
