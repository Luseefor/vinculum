import type { GraphObject, VectorFieldObject } from "@vinculum/scene/types";

// S20 PART 30: collapsed rows show `F(x,y)=<x, y>` truncated to 30 chars;
// the full definition belongs in a tooltip/expanded editor.
function formatPrimitiveSnippet(snippet: string): string {
  const compact = snippet.replace(/\s+/g, "");
  return compact.length > 30 ? `${compact.slice(0, 29)}…` : compact;
}

function formatMathSnippet(snippet: string): string {
  const compact = snippet.replace(/\s+/g, " ").trim();
  return compact.length > 30 ? `${compact.slice(0, 29)}…` : compact;
}

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
  if (object.kind === "point") {
    return ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
  }
  if (object.kind === "linearTransform") {
    const entries =
      object.dimension === "2d"
        ? [object.m11, object.m12, object.m21, object.m22]
        : [object.m11, object.m12, object.m13, object.m21, object.m22, object.m23, object.m31, object.m32, object.m33];
    return !entries.some((expr) => expr.trim());
  }
  if (object.kind === "vector") {
    return ![
      object.oxExpr,
      object.oyExpr,
      object.ozExpr,
      object.vxExpr,
      object.vyExpr,
      object.vzExpr
    ].some((expr) => expr.trim());
  }
  if (object.kind === "line") {
    return ![
      object.pxExpr,
      object.pyExpr,
      object.pzExpr,
      object.dxExpr,
      object.dyExpr,
      object.dzExpr
    ].some((expr) => expr.trim());
  }
  if (object.kind === "ray") {
    return ![
      object.oxExpr,
      object.oyExpr,
      object.ozExpr,
      object.dxExpr,
      object.dyExpr,
      object.dzExpr
    ].some((expr) => expr.trim());
  }
  if (object.kind === "segment") {
    return ![
      object.axExpr,
      object.ayExpr,
      object.azExpr,
      object.bxExpr,
      object.byExpr,
      object.bzExpr
    ].some((expr) => expr.trim());
  }
  return ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
}

export function getObjectRowDisplayMeta(object: GraphObject): { label: string; type: string } {
  if (object.kind === "plane") {
    if (!object.equation.trim()) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return { label: "Plane", type: formatPrimitiveSnippet(object.equation) };
  }
  if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
    const allEmpty = ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    if (object.kind === "parametricSurface") {
      // S32: collapsed rows prioritize the mathematical definition.
      return {
        label: "Parametric Surface",
        type: formatMathSnippet(`r(u,v) = <${object.xExpr}, ${object.yExpr}, ${object.zExpr}>`)
      };
    }
    const normalized = [object.xExpr, object.yExpr, object.zExpr].map((v) => v.replace(/\s+/g, ""));
    const isPoint = normalized.every((v) => v === "0" || v === "0.0");
    // S30: canonical creation taxonomy — rows match descriptors
    // ("Parametric Curve", legacy all-zero preset keeps "Point").
    // S32: non-degenerate curves show the tuple definition in the row.
    if (isPoint) {
      return { label: "Point", type: "Point" };
    }
    return {
      label: "Parametric Curve",
      type: formatMathSnippet(`r(t) = <${object.xExpr}, ${object.yExpr}, ${object.zExpr}>`)
    };
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
  // S26/S27: compact primitive snippets (PART 26). Full definitions live
  // in the Inspector editor; collapsed rows show one short mathematical
  // line. Canonical points render P=(x,y,z); the legacy all-zero
  // parametricCurve preset keeps its historical "Point" label untouched.
  if (object.kind === "point") {
    const allEmpty = ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return {
      label: "Point",
      type: formatPrimitiveSnippet(`P=(${object.xExpr},${object.yExpr},${object.zExpr})`)
    };
  }
  if (object.kind === "vector") {
    const allEmpty = ![
      object.oxExpr,
      object.oyExpr,
      object.ozExpr,
      object.vxExpr,
      object.vyExpr,
      object.vzExpr
    ].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return { label: "Vector", type: formatPrimitiveSnippet(`v=<${object.vxExpr},${object.vyExpr},${object.vzExpr}>`) };
  }
  if (object.kind === "line") {
    const allEmpty = ![
      object.pxExpr,
      object.pyExpr,
      object.pzExpr,
      object.dxExpr,
      object.dyExpr,
      object.dzExpr
    ].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return {
      label: "Infinite Line",
      type: formatPrimitiveSnippet(
        `L:(${object.pxExpr},${object.pyExpr},${object.pzExpr})+t<${object.dxExpr},${object.dyExpr},${object.dzExpr}>`
      )
    };
  }
  if (object.kind === "ray") {
    const allEmpty = ![
      object.oxExpr,
      object.oyExpr,
      object.ozExpr,
      object.dxExpr,
      object.dyExpr,
      object.dzExpr
    ].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return {
      label: "Ray",
      type: formatPrimitiveSnippet(
        `R:(${object.oxExpr},${object.oyExpr},${object.ozExpr})+t<${object.dxExpr},${object.dyExpr},${object.dzExpr}>,t\u22650`
      )
    };
  }
  if (object.kind === "segment") {
    const allEmpty = ![
      object.axExpr,
      object.ayExpr,
      object.azExpr,
      object.bxExpr,
      object.byExpr,
      object.bzExpr
    ].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return {
      label: "Segment",
      type: formatPrimitiveSnippet(
        `S:(${object.axExpr},${object.ayExpr},${object.azExpr})→(${object.bxExpr},${object.byExpr},${object.bzExpr})`
      )
    };
  }
  // S28: compact matrix indicator (PART 40) — never editable fields in
  // the collapsed row. 2D shows the full 2×2; 3D truncates.
  if (object.kind === "linearTransform") {
    const entries =
      object.dimension === "2d"
        ? [object.m11, object.m12, object.m21, object.m22]
        : [
            object.m11, object.m12, object.m13,
            object.m21, object.m22, object.m23,
            object.m31, object.m32, object.m33
          ];
    if (!entries.some((expr) => expr.trim())) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    if (object.dimension === "2d") {
      return {
        label: "Linear Transformation",
        type: formatPrimitiveSnippet(`[[${object.m11},${object.m12}],[${object.m21},${object.m22}]]`)
      };
    }
    return { label: "Linear Transformation", type: "3×3 matrix" };
  }
  if (!object.equation.trim()) {
    return { label: "Expression", type: "Choose type in menu" };
  }
  if (object.kind === "implicitSurface") {
    // S32: collapsed rows prioritize the mathematical definition.
    return { label: "Implicit Surface", type: formatMathSnippet(object.equation) };
  }
  if (object.kind === "surface") {
    const orientation = object.orientation ?? "z";
    const preset = object.equation.replace(/\s+/g, "");
    if (preset === "sqrt(max(0,9-x^2-y^2))") return { label: "Sphere", type: formatMathSnippet(`${orientation} = ${object.equation}`) };
    if (preset === "sqrt(max(0,4-x^2))") return { label: "Cylinder", type: formatMathSnippet(`${orientation} = ${object.equation}`) };
    // S32: collapsed rows prioritize the mathematical definition.
    return { label: "Surface", type: formatMathSnippet(`${orientation} = ${object.equation}`) };
  }
  // All equation-bearing kinds (plane, surface, implicitSurface) are handled
  // above; remaining kinds carry no equation.
  const _exhaustive: never = object;
  void _exhaustive;
  return { label: "Expression", type: "Choose type in menu" };
}
