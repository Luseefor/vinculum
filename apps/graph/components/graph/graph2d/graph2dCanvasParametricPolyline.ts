import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { worldIndexForMathAxis } from "@/lib/math/coordinates";
import { sampleCurve } from "@/lib/math/sampleCurve";
import type { ParametricCurveObject } from "@vinculum/scene/types";
import type { AxisVariable } from "./graph2dCanvasTypes";

export function buildParametricPolylineHV(
  obj: ParametricCurveObject,
  horizontal: AxisVariable,
  vertical: AxisVariable
): Float64Array | null {
  if (![obj.xExpr, obj.yExpr, obj.zExpr].some((expr) => expr.trim())) {
    return null;
  }
  const compiled = compileParametricExpressions(obj.xExpr, obj.yExpr, obj.zExpr);
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
  const pointCount = sampled.positions.length / 3;
  if (pointCount < 2) {
    return null;
  }

  const poly = new Float64Array(pointCount * 2);
  for (let i = 0; i < pointCount; i += 1) {
    poly[i * 2] = sampled.positions[i * 3 + hi];
    poly[i * 2 + 1] = sampled.positions[i * 3 + vi];
  }

  return poly;
}
