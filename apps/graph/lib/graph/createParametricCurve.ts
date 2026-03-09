import { createDefaultParametricCurve } from "@vinculum/scene/defaults";
import type { ParametricCurveObject } from "@vinculum/scene/types";

interface CreateParametricCurveInput {
  colorIndex?: number;
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  tMin?: number;
  tMax?: number;
  samples?: number;
  visible?: boolean;
  color?: string;
  id?: string;
}

let parametricCurveCounter = 0;

function createParametricCurveId(): string {
  parametricCurveCounter += 1;
  return `curve-${Date.now().toString(36)}-${parametricCurveCounter.toString(36)}`;
}

export function createParametricCurve(input: CreateParametricCurveInput = {}): ParametricCurveObject {
  return createDefaultParametricCurve({
    id: input.id ?? createParametricCurveId(),
    index: input.colorIndex,
    xExpr: input.xExpr,
    yExpr: input.yExpr,
    zExpr: input.zExpr,
    tMin: input.tMin,
    tMax: input.tMax,
    samples: input.samples,
    visible: input.visible,
    color: input.color
  });
}
