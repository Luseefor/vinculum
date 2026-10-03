import { createDefaultParametricSurfaceGraph } from "@vinculum/scene/defaults";
import type { ParametricSurfaceDomain, ParametricSurfaceObject, SurfaceAppearance } from "@vinculum/scene/types";

interface CreateParametricSurfaceGraphInput {
  colorIndex?: number;
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  domain?: Partial<ParametricSurfaceDomain>;
  resolution?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<SurfaceAppearance>;
  id?: string;
}

let parametricSurfaceGraphCounter = 0;

function createParametricSurfaceGraphId(): string {
  parametricSurfaceGraphCounter += 1;
  return `parametric-surface-${Date.now().toString(36)}-${parametricSurfaceGraphCounter.toString(36)}`;
}

export function createParametricSurfaceGraph(input: CreateParametricSurfaceGraphInput = {}): ParametricSurfaceObject {
  return createDefaultParametricSurfaceGraph({
    id: input.id ?? createParametricSurfaceGraphId(),
    index: input.colorIndex,
    xExpr: input.xExpr,
    yExpr: input.yExpr,
    zExpr: input.zExpr,
    domain: input.domain,
    resolution: input.resolution,
    visible: input.visible,
    color: input.color,
    appearance: input.appearance
  });
}
