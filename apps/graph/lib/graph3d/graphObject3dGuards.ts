import type { GraphObject } from "@vinculum/scene/types";

export function isGraphObjectRenderable3D(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane" || object.kind === "implicitSurface") {
    return object.equation.trim().length > 0;
  }
  if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
    return [object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim().length > 0);
  }
  if (object.kind === "vectorField") {
    // S20: only 3D fields render in the shared Three scene. 2D fields take
    // the non-renderable path here (no job, no node); Math Lab 2D samples
    // them synchronously in the Canvas2D builder instead.
    return (
      object.dimension === "3d" &&
      [object.pExpr, object.qExpr, object.rExpr].some((expr) => expr.trim().length > 0)
    );
  }
  if (object.kind === "vector") {
    return [object.oxExpr, object.oyExpr, object.ozExpr, object.vxExpr, object.vyExpr, object.vzExpr].some(
      (expr) => expr.trim().length > 0
    );
  }
  if (object.kind === "line") {
    return [object.pxExpr, object.pyExpr, object.pzExpr, object.dxExpr, object.dyExpr, object.dzExpr].some(
      (expr) => expr.trim().length > 0
    );
  }
  if (object.kind === "ray") {
    return [object.oxExpr, object.oyExpr, object.ozExpr, object.dxExpr, object.dyExpr, object.dzExpr].some(
      (expr) => expr.trim().length > 0
    );
  }
  if (object.kind === "segment") {
    return [object.axExpr, object.ayExpr, object.azExpr, object.bxExpr, object.byExpr, object.bzExpr].some(
      (expr) => expr.trim().length > 0
    );
  }
  return false;
}

export function sceneHasVisibleSurface(objects: GraphObject[]): boolean {
  return objects.some(
    (object) =>
      object.visible &&
      (object.kind === "surface" ||
        object.kind === "parametricSurface" ||
        object.kind === "implicitSurface") &&
      isGraphObjectRenderable3D(object)
  );
}
