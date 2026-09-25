import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { compileGeometryCoordinate } from "@/lib/math/compileGeometryCoordinate";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import type { ExpressionValidationState } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";

function firstPrimitiveCoordinateError(
  object: Extract<GraphObject, { kind: "vector" | "line" | "ray" | "segment" }>
): string | null {
  const fields =
    object.kind === "vector"
      ? [object.oxExpr, object.oyExpr, object.ozExpr, object.vxExpr, object.vyExpr, object.vzExpr]
      : object.kind === "line"
        ? [object.pxExpr, object.pyExpr, object.pzExpr, object.dxExpr, object.dyExpr, object.dzExpr]
        : object.kind === "ray"
          ? [object.oxExpr, object.oyExpr, object.ozExpr, object.dxExpr, object.dyExpr, object.dzExpr]
          : [object.axExpr, object.ayExpr, object.azExpr, object.bxExpr, object.byExpr, object.bzExpr];
  const scope = getEditorParameterScope();
  for (const expr of fields) {
    if (!expr.trim()) {
      continue;
    }
    const compiled = compileGeometryCoordinate(expr, scope);
    if (compiled.error) {
      return compiled.error;
    }
  }
  return null;
}

export function getExpressionRowValidation(object: GraphObject): ExpressionValidationState {
  if (object.kind === "surface") {
    return { error: compileSurfaceExpression(object.equation, object.orientation || "z").error };
  }

  if (object.kind === "parametricCurve") {
    return {
      error: compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr).error
    };
  }

  if (object.kind === "parametricSurface") {
    return {
      error: compileParametricSurfaceExpressions(
        object.xExpr,
        object.yExpr,
        object.zExpr,
        getEditorParameterScope()
      ).error
    };
  }

  if (object.kind === "implicitSurface") {
    return {
      error: compileImplicitSurfaceExpression(object.equation, getEditorParameterScope()).error
    };
  }

  if (object.kind === "vectorField") {
    // S20: whole-field compile (unknown symbols, reserved locals, empty
    // components). Empty components stay valid-but-unrendered downstream;
    // report only the first hard error here, like the surface paths.
    const compiled = compileVectorFieldExpressions(
      object.dimension,
      object.pExpr,
      object.qExpr,
      object.rExpr,
      getEditorParameterScope()
    );
    if (compiled.error && !isEmptyComponentError(compiled.error)) {
      return { error: compiled.error };
    }
    return { error: null };
  }

  if (
    object.kind === "vector" ||
    object.kind === "line" ||
    object.kind === "ray" ||
    object.kind === "segment"
  ) {
    // S26: first coordinate hard error, or null (empty fields stay
    // valid-but-unrendered downstream; per-field messages live in the
    // coordinate editor).
    return { error: firstPrimitiveCoordinateError(object) };
  }

  return { error: compilePlaneEquation(object.equation).error };
}

function isEmptyComponentError(error: string): boolean {
  return /^[PQR]\(x,y(,z)?\) cannot be empty\.$/.test(error);
}
