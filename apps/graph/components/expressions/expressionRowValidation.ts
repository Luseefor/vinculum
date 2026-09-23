import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import type { ExpressionValidationState } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";

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

  return { error: compilePlaneEquation(object.equation).error };
}

function isEmptyComponentError(error: string): boolean {
  return /^[PQR]\(x,y(,z)?\) cannot be empty\.$/.test(error);
}
