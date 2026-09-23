import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
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
      error: compileParametricSurfaceExpressions(object.xExpr, object.yExpr, object.zExpr).error
    };
  }

  if (object.kind === "implicitSurface") {
    return {
      error: compileImplicitSurfaceExpression(object.equation).error
    };
  }

  return { error: compilePlaneEquation(object.equation).error };
}
