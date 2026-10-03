import { createDefaultVectorFieldGraph } from "@vinculum/scene/defaults";
import type {
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D,
  VectorFieldObject,
  VectorFieldObject2D,
  VectorFieldObject3D
} from "@vinculum/scene/types";

interface CreateVectorFieldGraphInput {
  colorIndex?: number;
  dimension?: VectorFieldDimension;
  pExpr?: string;
  qExpr?: string;
  rExpr?: string;
  domain?: Partial<VectorFieldDomain2D & VectorFieldDomain3D>;
  density?: number;
  scale?: number;
  normalize?: boolean;
  visible?: boolean;
  color?: string;
  id?: string;
}

let vectorFieldGraphCounter = 0;

function createVectorFieldGraphId(): string {
  vectorFieldGraphCounter += 1;
  return `vector-field-${Date.now().toString(36)}-${vectorFieldGraphCounter.toString(36)}`;
}

export function createVectorFieldGraph(input: CreateVectorFieldGraphInput & { dimension: "2d" }): VectorFieldObject2D;
export function createVectorFieldGraph(input: CreateVectorFieldGraphInput & { dimension: "3d" }): VectorFieldObject3D;
export function createVectorFieldGraph(input: CreateVectorFieldGraphInput): VectorFieldObject;
export function createVectorFieldGraph(input: CreateVectorFieldGraphInput = {}): VectorFieldObject {
  const dimension = input.dimension ?? "2d";
  if (dimension === "2d") {
    return createDefaultVectorFieldGraph({
      id: input.id ?? createVectorFieldGraphId(),
      index: input.colorIndex,
      dimension: "2d",
      pExpr: input.pExpr,
      qExpr: input.qExpr,
      domain: input.domain,
      density: input.density,
      scale: input.scale,
      normalize: input.normalize,
      visible: input.visible,
      color: input.color
    });
  }
  return createDefaultVectorFieldGraph({
    id: input.id ?? createVectorFieldGraphId(),
    index: input.colorIndex,
    dimension: "3d",
    pExpr: input.pExpr,
    qExpr: input.qExpr,
    rExpr: input.rExpr,
    domain: input.domain,
    density: input.density,
    scale: input.scale,
    normalize: input.normalize,
    visible: input.visible,
    color: input.color
  });
}
