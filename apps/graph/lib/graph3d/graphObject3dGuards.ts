import type { GraphObject } from "@vinculum/scene/types";

export function isGraphObjectRenderable3D(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane") {
    return object.equation.trim().length > 0;
  }
  if (object.kind === "parametricCurve") {
    return [object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim().length > 0);
  }
  return false;
}

export function sceneHasVisibleSurface(objects: GraphObject[]): boolean {
  return objects.some(
    (object) => object.visible && object.kind === "surface" && isGraphObjectRenderable3D(object)
  );
}
