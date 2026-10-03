import { normalizeVectorFieldDensity, normalizeVectorFieldScale } from "@vinculum/scene/defaults";
import type { VectorFieldObject } from "@vinculum/scene/types";
import type { VectorFieldField } from "./graphStoreTypes";

// Mirrors updateImplicitSurfaceField: component expressions commit as
// strings; density/scale commit as validated numbers (null rejects);
// normalize commits as a boolean (null rejects); domain keys commit as
// finite numbers. 2D fields reject zMin/zMax and rExpr writes: R belongs
// to 3D only, enforced here as well as at the import boundary.
export function updateVectorFieldField(
  object: VectorFieldObject,
  field: VectorFieldField,
  value: string | number | boolean
): VectorFieldObject | null {
  if (field === "pExpr" || field === "qExpr" || field === "rExpr") {
    if (field === "rExpr" && object.dimension === "2d") {
      return null;
    }
    return {
      ...object,
      [field]: String(value)
    };
  }

  if (field === "normalize") {
    if (typeof value !== "boolean") {
      return null;
    }
    return {
      ...object,
      normalize: value
    };
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (field === "density") {
    return {
      ...object,
      density: normalizeVectorFieldDensity(parsedValue, object.dimension)
    };
  }

  if (field === "scale") {
    return {
      ...object,
      scale: normalizeVectorFieldScale(parsedValue)
    };
  }

  if ((field === "zMin" || field === "zMax") && object.dimension === "2d") {
    return null;
  }

  if (object.dimension === "2d") {
    return {
      ...object,
      dimension: "2d",
      domain: {
        ...object.domain,
        [field]: parsedValue
      }
    };
  }

  return {
    ...object,
    dimension: "3d",
    domain: {
      ...object.domain,
      [field]: parsedValue
    }
  };
}
