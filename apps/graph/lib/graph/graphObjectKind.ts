import type { GraphObjectKind } from "@vinculum/scene/types";

export function parseGraphObjectKind(value: string): GraphObjectKind | null {
  if (
    value === "surface" ||
    value === "parametricCurve" ||
    value === "plane" ||
    value === "parametricSurface" ||
    value === "implicitSurface" ||
    value === "point" ||
    value === "vector" ||
    value === "line" ||
    value === "ray" ||
    value === "segment"
  ) {
    return value;
  }
  return null;
}
