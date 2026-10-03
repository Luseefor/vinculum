import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import type { GraphObject } from "@vinculum/scene/types";

/** Project an opted-in curve into the existing surface renderer without changing scene data. */
export function getGraphObjectFor3D(object: GraphObject): GraphObject {
  if (object.kind !== "implicitCurve" || !object.extendTo3D) return object;
  return createImplicitSurfaceGraph({ id: object.id, equation: object.equation, color: object.color, visible: object.visible, resolution: 48 });
}

export function isGraphObjectRenderable3D(object: GraphObject): boolean {
  if (object.kind === "implicitCurve") return object.equation.trim().length > 0;
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
  if (object.kind === "point") {
    return [object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim().length > 0);
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
  if (object.kind === "linearTransform") {
    const entries =
      object.dimension === "2d"
        ? [object.m11, object.m12, object.m21, object.m22]
        : [object.m11, object.m12, object.m13, object.m21, object.m22, object.m23, object.m31, object.m32, object.m33];
    return entries.some((expr) => expr.trim().length > 0);
  }
  return false;
}

export function sceneHasVisibleSurface(objects: GraphObject[]): boolean {
  return objects.some(
    (object) =>
      object.visible &&
      (object.kind === "surface" ||
        object.kind === "parametricSurface" ||
        object.kind === "implicitSurface" ||
        (object.kind === "implicitCurve" && object.extendTo3D === true)) &&
      isGraphObjectRenderable3D(object)
  );
}
