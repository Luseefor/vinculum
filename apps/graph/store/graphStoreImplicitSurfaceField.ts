import { normalizeImplicitSurfaceResolution } from "@vinculum/scene/defaults";
import type { ImplicitSurfaceObject } from "@vinculum/scene/types";
import type { ImplicitSurfaceField } from "./graphStoreTypes";

// Mirrors updateParametricSurfaceField: the equation commits as a string;
// domain and resolution commit as validated numbers (null rejects).
export function updateImplicitSurfaceField(
  object: ImplicitSurfaceObject,
  field: ImplicitSurfaceField,
  value: string | number
): ImplicitSurfaceObject | null {
  if (field === "equation") {
    return {
      ...object,
      equation: String(value)
    };
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (field === "resolution") {
    return {
      ...object,
      resolution: normalizeImplicitSurfaceResolution(parsedValue)
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
