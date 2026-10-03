import { createDefaultPointObject } from "@vinculum/scene/defaults";
import type { PointObject } from "@vinculum/scene/types";

interface CreatePointGraphInput {
  colorIndex?: number;
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  visible?: boolean;
  color?: string;
  id?: string;
}

let pointGraphCounter = 0;

function createPointGraphId(): string {
  pointGraphCounter += 1;
  return `point-${Date.now().toString(36)}-${pointGraphCounter.toString(36)}`;
}

export function createPointGraph(input: CreatePointGraphInput = {}): PointObject {
  return createDefaultPointObject({
    id: input.id ?? createPointGraphId(),
    index: input.colorIndex,
    xExpr: input.xExpr,
    yExpr: input.yExpr,
    zExpr: input.zExpr,
    visible: input.visible,
    color: input.color
  });
}
