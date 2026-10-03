// S28 matrix-entry commits for linearTransform objects. Entries commit
// as raw strings (validation lives in the shared coordinate compiler +
// import parser); non-strings or off-dimension writes reject with null.
// 2D objects reject m13/m23/m31/m32/m33 writes: the third row/column
// belongs to 3D only, enforced here as well as at the import boundary.
import type { LinearTransformObject } from "@vinculum/scene/types";
import type { LinearTransformEntryField } from "./graphStoreTypes";

const ENTRY_FIELDS_2D: ReadonlySet<string> = new Set(["m11", "m12", "m21", "m22"]);

const ENTRY_FIELDS_3D: ReadonlySet<string> = new Set([
  "m11",
  "m12",
  "m13",
  "m21",
  "m22",
  "m23",
  "m31",
  "m32",
  "m33"
]);

export function updateLinearTransformField(
  object: LinearTransformObject,
  field: LinearTransformEntryField,
  value: string
): LinearTransformObject | null {
  if (typeof value !== "string") {
    return null;
  }
  const allowed = object.dimension === "2d" ? ENTRY_FIELDS_2D : ENTRY_FIELDS_3D;
  if (!allowed.has(field)) {
    return null;
  }
  return {
    ...object,
    [field]: value
  };
}

/**
 * Deterministic dimension conversion preserving entries (PART 41):
 * 2D→3D embeds [a b 0; c d 0; 0 0 1] (2D transform on XY, z fixed);
 * 3D→2D keeps the top-left 2×2. Raw strings carry over untouched.
 */
export function convertLinearTransformDimension(
  object: LinearTransformObject,
  dimension: "2d" | "3d"
): LinearTransformObject {
  if (object.dimension === dimension) {
    return object;
  }
  const base = { id: object.id, color: object.color, visible: object.visible };
  if (dimension === "3d") {
    const source = object as Extract<LinearTransformObject, { dimension: "2d" }>;
    return {
      ...base,
      kind: "linearTransform",
      dimension: "3d",
      m11: source.m11,
      m12: source.m12,
      m13: "0",
      m21: source.m21,
      m22: source.m22,
      m23: "0",
      m31: "0",
      m32: "0",
      m33: "1"
    };
  }
  const source = object as Extract<LinearTransformObject, { dimension: "3d" }>;
  return {
    ...base,
    kind: "linearTransform",
    dimension: "2d",
    m11: source.m11,
    m12: source.m12,
    m21: source.m21,
    m22: source.m22
  };
}
