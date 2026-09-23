import type { GraphObjectKind } from "@vinculum/scene/types";

export function parseGraphObjectKind(value: string): GraphObjectKind | null {
  if (value === "surface" || value === "parametricCurve" || value === "plane" || value === "parametricSurface") {
    return value;
  }
  return null;
}
