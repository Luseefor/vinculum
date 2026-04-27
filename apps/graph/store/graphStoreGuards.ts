import type { GraphObject, ParametricCurveObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";

export function isSurfaceGraphObject(object: GraphObject): object is SurfaceGraphObject {
  return object.kind === "surface";
}

export function isParametricCurveObject(object: GraphObject): object is ParametricCurveObject {
  return object.kind === "parametricCurve";
}

export function isPlaneGraphObject(object: GraphObject): object is PlaneGraphObject {
  return object.kind === "plane";
}
