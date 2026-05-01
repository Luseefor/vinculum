import type { GraphObject } from "@vinculum/scene/types";

export function isExpressionRowEmpty(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane") {
    return !object.equation.trim();
  }
  return ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
}

export function getObjectRowDisplayMeta(object: GraphObject): { label: string; type: string } {
  if (object.kind === "plane") {
    if (!object.equation.trim()) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return { label: "Plane", type: "Plane" };
  }
  if (object.kind === "parametricCurve") {
    const allEmpty = ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    const normalized = [object.xExpr, object.yExpr, object.zExpr].map((v) => v.replace(/\s+/g, ""));
    const isPoint = normalized.every((v) => v === "0" || v === "0.0");
    return isPoint ? { label: "Point", type: "Point" } : { label: "Curve", type: "Curve" };
  }
  if (!object.equation.trim()) {
    return { label: "Expression", type: "Choose type in menu" };
  }
  const equation = object.equation.replace(/\s+/g, "");
  if (equation === "sqrt(max(0,9-x^2-y^2))") return { label: "Sphere", type: "Sphere" };
  if (equation === "sqrt(max(0,4-x^2))") return { label: "Cylinder", type: "Cylinder" };
  return { label: "Surface", type: "Surface" };
}
