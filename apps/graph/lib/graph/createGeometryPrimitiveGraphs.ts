// S26 canonical geometric-primitive constructors (one responsibility:
// id assignment + scene-package defaults). Mirrors createPlaneGraph and
// friends: thin wrappers so the store factory never touches defaults
// directly.
import {
  createDefaultLineObject,
  createDefaultRayObject,
  createDefaultSegmentObject,
  createDefaultVectorObject
} from "@vinculum/scene/defaults";
import type { LineObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";

interface CreateGeometryPrimitiveInput {
  colorIndex?: number;
  visible?: boolean;
  color?: string;
  id?: string;
}

type CoordinateOverrides = Partial<{
  oxExpr: string;
  oyExpr: string;
  ozExpr: string;
  vxExpr: string;
  vyExpr: string;
  vzExpr: string;
  pxExpr: string;
  pyExpr: string;
  pzExpr: string;
  dxExpr: string;
  dyExpr: string;
  dzExpr: string;
  axExpr: string;
  ayExpr: string;
  azExpr: string;
  bxExpr: string;
  byExpr: string;
  bzExpr: string;
}>;

let geometryPrimitiveCounter = 0;

function createGeometryPrimitiveId(prefix: string): string {
  geometryPrimitiveCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${geometryPrimitiveCounter.toString(36)}`;
}

export function createVectorGraph(
  input: CreateGeometryPrimitiveInput & CoordinateOverrides = {}
): VectorObject {
  const { colorIndex, visible, color, id, ...coords } = input;
  return createDefaultVectorObject({
    id: id ?? createGeometryPrimitiveId("vector"),
    index: colorIndex,
    visible,
    color,
    ...coords
  });
}

export function createLineGraph(
  input: CreateGeometryPrimitiveInput & CoordinateOverrides = {}
): LineObject {
  const { colorIndex, visible, color, id, ...coords } = input;
  return createDefaultLineObject({
    id: id ?? createGeometryPrimitiveId("line"),
    index: colorIndex,
    visible,
    color,
    ...coords
  });
}

export function createRayGraph(
  input: CreateGeometryPrimitiveInput & CoordinateOverrides = {}
): RayObject {
  const { colorIndex, visible, color, id, ...coords } = input;
  return createDefaultRayObject({
    id: id ?? createGeometryPrimitiveId("ray"),
    index: colorIndex,
    visible,
    color,
    ...coords
  });
}

export function createSegmentGraph(
  input: CreateGeometryPrimitiveInput & CoordinateOverrides = {}
): SegmentObject {
  const { colorIndex, visible, color, id, ...coords } = input;
  return createDefaultSegmentObject({
    id: id ?? createGeometryPrimitiveId("segment"),
    index: colorIndex,
    visible,
    color,
    ...coords
  });
}
