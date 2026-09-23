import { normalizeParametricSurfaceResolution } from "@vinculum/scene/defaults";
import type { ParametricSurfaceObject } from "@vinculum/scene/types";
import type { ParametricSurfaceField } from "./graphStoreTypes";

// Mirrors updateParametricCurveField: coordinate expressions commit as
// strings; domain and resolution commit as validated numbers (null rejects).
export function updateParametricSurfaceField(
  object: ParametricSurfaceObject,
  field: ParametricSurfaceField,
  value: string | number
): ParametricSurfaceObject | null {
  if (field === "xExpr" || field === "yExpr" || field === "zExpr") {
    return {
      ...object,
      [field]: String(value)
    };
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (field === "resolution") {
    return {
      ...object,
      resolution: normalizeParametricSurfaceResolution(parsedValue)
    };
  }

  return {
    ...object,
    domain: {
      ...object.domain,
      [field]: parsedValue
    }
  };
}
