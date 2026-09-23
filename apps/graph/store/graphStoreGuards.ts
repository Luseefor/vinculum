import type { GraphObject, ParametricCurveObject, ParametricSurfaceObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";

export function isSurfaceGraphObject(object: GraphObject): object is SurfaceGraphObject {
  return object.kind === "surface";
}

export function isParametricCurveObject(object: GraphObject): object is ParametricCurveObject {
  return object.kind === "parametricCurve";
}

export function isParametricSurfaceObject(object: GraphObject): object is ParametricSurfaceObject {
  return object.kind === "parametricSurface";
}

export function isPlaneGraphObject(object: GraphObject): object is PlaneGraphObject {
  return object.kind === "plane";
}
