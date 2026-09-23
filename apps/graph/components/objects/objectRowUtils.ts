import type { GraphObject, VectorFieldObject } from "@vinculum/scene/types";

// S20 PART 30: collapsed rows show `F(x,y)=<x, y>` truncated to 30 chars;
// the full definition belongs in a tooltip/expanded editor.
function formatVectorFieldSnippet(object: VectorFieldObject): string {
  const coords = object.dimension === "2d" ? "x,y" : "x,y,z";
  const components =
    object.dimension === "2d" ? [object.pExpr, object.qExpr] : [object.pExpr, object.qExpr, object.rExpr];
  const snippet = `F(${coords})=<${components.map((component) => component.trim()).join(", ")}>`;
  return snippet.length > 30 ? `${snippet.slice(0, 29)}…` : snippet;
}

export function isExpressionRowEmpty(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane" || object.kind === "implicitSurface") {
    return !object.equation.trim();
  }
  if (object.kind === "vectorField") {
    return ![object.pExpr, object.qExpr, object.rExpr].some((expr) => expr.trim());
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
  if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
    const allEmpty = ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    if (object.kind === "parametricSurface") {
      return { label: "Parametric Surface", type: "Parametric Surface" };
    }
    const normalized = [object.xExpr, object.yExpr, object.zExpr].map((v) => v.replace(/\s+/g, ""));
    const isPoint = normalized.every((v) => v === "0" || v === "0.0");
    return isPoint ? { label: "Point", type: "Point" } : { label: "Curve", type: "Curve" };
  }
  // S20: compact field identity — never the full component list in a
  // collapsed row (PART 30). Must precede `.equation` access below, which
  // this kind does not define.
  if (object.kind === "vectorField") {
    const allEmpty = ![object.pExpr, object.qExpr, object.rExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return { label: "Vector Field", type: formatVectorFieldSnippet(object) };
  }
  if (!object.equation.trim()) {
    return { label: "Expression", type: "Choose type in menu" };
  }
  if (object.kind === "implicitSurface") {
    return { label: "Implicit Surface", type: "Implicit Surface" };
  }
  const equation = object.equation.replace(/\s+/g, "");
  if (equation === "sqrt(max(0,9-x^2-y^2))") return { label: "Sphere", type: "Sphere" };
  if (equation === "sqrt(max(0,4-x^2))") return { label: "Cylinder", type: "Cylinder" };
  return { label: "Surface", type: "Surface" };
}
