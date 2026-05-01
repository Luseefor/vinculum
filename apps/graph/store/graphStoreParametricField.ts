import type { ParametricCurveObject } from "@vinculum/scene/types";
import type { ParametricExpressionField } from "./graphStoreTypes";

export function updateParametricCurveField(
  object: ParametricCurveObject,
  field: ParametricExpressionField,
  value: string | number
): ParametricCurveObject | null {
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

  if (field === "samples") {
    return {
      ...object,
      samples: Math.max(2, Math.floor(parsedValue))
    };
  }

  return {
    ...object,
    [field]: parsedValue
  };
}
