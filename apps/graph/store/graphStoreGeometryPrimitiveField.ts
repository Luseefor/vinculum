// S26 per-kind coordinate-field commits for geometric primitives.
// Coordinate fields commit as strings (validation lives in the shared
// coordinate compiler + import parser); non-string or off-kind writes
// reject with null. Mirrors updateVectorFieldField's expression branch.
import type { LineObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";
import type { GeometryPrimitiveField } from "./graphStoreTypes";

type GeometryPrimitiveObject = VectorObject | LineObject | RayObject | SegmentObject;

const VECTOR_FIELDS: ReadonlySet<string> = new Set([
  "oxExpr",
  "oyExpr",
  "ozExpr",
  "vxExpr",
  "vyExpr",
  "vzExpr"
]);

const LINE_FIELDS: ReadonlySet<string> = new Set([
  "pxExpr",
  "pyExpr",
  "pzExpr",
  "dxExpr",
  "dyExpr",
  "dzExpr"
]);

const RAY_FIELDS: ReadonlySet<string> = new Set([
  "oxExpr",
  "oyExpr",
  "ozExpr",
  "dxExpr",
  "dyExpr",
  "dzExpr"
]);

const SEGMENT_FIELDS: ReadonlySet<string> = new Set([
  "axExpr",
  "ayExpr",
  "azExpr",
  "bxExpr",
  "byExpr",
  "bzExpr"
]);

export function updateGeometryPrimitiveField(
  object: GeometryPrimitiveObject,
  field: GeometryPrimitiveField,
  value: string
): GeometryPrimitiveObject | null {
  if (typeof value !== "string") {
    return null;
  }
  const allowed =
    object.kind === "vector"
      ? VECTOR_FIELDS
      : object.kind === "line"
        ? LINE_FIELDS
        : object.kind === "ray"
          ? RAY_FIELDS
          : SEGMENT_FIELDS;
  if (!allowed.has(field)) {
    return null;
  }
  return {
    ...object,
    [field]: value
  };
}
