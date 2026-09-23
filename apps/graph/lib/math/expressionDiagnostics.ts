import { validateExpressionSafety, type ExpressionSafetyFailureCode } from "./expressionSafety";
import { compileSurfaceExpression, getEffectiveSurfaceOrientation } from "./compileExpression";
import { compilePlaneEquation } from "./samplePlane";
import { compileParametricExpressions } from "./compileParametric";
import { compileParametricSurfaceExpressions } from "./compileParametricSurface";
import { compileImplicitSurfaceExpression } from "./compileImplicitSurface";
import { splitSingleMathEquality } from "./implicitEquation";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

export type ExpressionDiagnosticStatus = "valid" | "warning" | "error";

export interface ExpressionDiagnostic {
  status: ExpressionDiagnosticStatus;
  message: string;
  suggestion?: string;
  fieldContext?: string;
}

const UNSUPPORTED_SUGGESTION = "Try using sin, cos, tan, sqrt, abs, exp, log, or pow";

function toSafeDiagnostics(base: ExpressionDiagnostic): ExpressionDiagnostic {
  return base;
}

function mapSafetyViolationToDiagnostic(code: ExpressionSafetyFailureCode): { message: string; suggestion?: string } {
  switch (code) {
    case "expression-too-long":
      return { message: "Expression is too long." };
    case "invalid-expression-syntax":
      return { message: "Invalid expression syntax." };
    case "unsupported-function":
      return { message: "Unsupported function.", suggestion: UNSUPPORTED_SUGGESTION };
    case "unsupported-symbol":
      return { message: "Unsupported symbol." };
    case "expression-too-complex":
      return { message: "Expression is too complex to render safely." };
    case "expression-disallowed-node":
      return { message: "This expression is not supported." };
    case "numeric-literal-out-of-range":
      return { message: "Expression contains a numeric literal that is too large." };
    default:
      return { message: "Invalid expression." };
  }
}

function stripLabelPrefix(error: string): string {
  // compileParametricErrors often look like "x(t): ..." or "y(t): ...";
  // parametric-surface errors look like "x(u,v): ...".
  const idx = error.indexOf(":");
  if (idx >= 0 && idx < error.length - 1) {
    const maybeLabel = error.slice(0, idx).trim();
    if (/(x\(t\)|y\(t\)|z\(t\)|x\(u,v\)|y\(u,v\)|z\(u,v\)|Parametric)/i.test(maybeLabel)) {
      return error.slice(idx + 1).trim();
    }
  }
  return error;
}

export function getSurfaceEquationDiagnostics(
  equation: string,
  orientation: "x" | "y" | "z" = "z"
): ExpressionDiagnostic {
  const trimmed = equation.trim();
  if (!trimmed) {
    return { status: "error", message: "Invalid expression syntax.", fieldContext: "surface.equation" };
  }

  const { body } = getEffectiveSurfaceOrientation(trimmed, orientation);
  if (!body) {
    return { status: "error", message: "Invalid expression syntax." };
  }

  const safety = validateExpressionSafety(body, {
    operation: "diagnostics-surface",
    expressionLabel: "Surface equation",
    allowedSymbols: Object.keys(getEditorParameterScope())
  });

  if (!safety.ok) {
    const mapped = mapSafetyViolationToDiagnostic(safety.violation.code);
    return toSafeDiagnostics({
      status: "error",
      message: mapped.message,
      suggestion: mapped.suggestion,
      fieldContext: "surface.equation"
    });
  }

  const compiled = compileSurfaceExpression(equation, orientation);
  if (compiled.error) {
    const msg = compiled.error;
    const nonFinite = msg.includes("Expression produced a non-finite value.");
    return toSafeDiagnostics({
      status: "error",
      message: nonFinite ? "Expression produced a non-finite value." : msg,
      fieldContext: "surface.equation"
    });
  }

  return { status: "valid", message: "", fieldContext: "surface.equation" };
}

export function getPlaneEquationDiagnostics(equation: string): ExpressionDiagnostic {
  const compiled = compilePlaneEquation(equation);
  if (compiled.error) {
    if (compiled.error === "Equation could not be evaluated." || compiled.error.includes("non-finite")) {
      return {
        status: "error",
        message: "Expression produced a non-finite value.",
        fieldContext: "plane.equation"
      };
    }
    return { status: "error", message: compiled.error, fieldContext: "plane.equation" };
  }
  return { status: "valid", message: "", fieldContext: "plane.equation" };
}

export function getParametricAxisDiagnostics(params: {
  field: "xExpr" | "yExpr" | "zExpr";
  xExpr: string;
  yExpr: string;
  zExpr: string;
}): ExpressionDiagnostic {
  const { field, xExpr, yExpr, zExpr } = params;

  const axisExpr = field === "xExpr" ? xExpr : field === "yExpr" ? yExpr : zExpr;
  const safety = validateExpressionSafety(axisExpr, {
    operation: "diagnostics-parametric-axis",
    expressionLabel: `Parametric ${field}`,
    allowedSymbols: Object.keys(getEditorParameterScope())
  });
  if (!safety.ok) {
    const mapped = mapSafetyViolationToDiagnostic(safety.violation.code);
    return toSafeDiagnostics({
      status: "error",
      message: mapped.message,
      suggestion: mapped.suggestion,
      fieldContext: `parametric.${field}`
    });
  }

  const compiled = compileParametricExpressions(xExpr, yExpr, zExpr);
  if (compiled.error) {
    return toSafeDiagnostics({
      status: "error",
      message: stripLabelPrefix(compiled.error),
      fieldContext: `parametric.${field}`
    });
  }

  return { status: "valid", message: "", fieldContext: `parametric.${field}` };
}

export function getParametricSurfaceAxisDiagnostics(params: {
  field: "xExpr" | "yExpr" | "zExpr";
  xExpr: string;
  yExpr: string;
  zExpr: string;
}): ExpressionDiagnostic {
  const { field, xExpr, yExpr, zExpr } = params;

  const axisExpr = field === "xExpr" ? xExpr : field === "yExpr" ? yExpr : zExpr;
  const safety = validateExpressionSafety(axisExpr, {
    operation: "diagnostics-parametric-surface-axis",
    expressionLabel: `Parametric surface ${field}`,
    allowedSymbols: [...Object.keys(getEditorParameterScope()), "u", "v"]
  });
  if (!safety.ok) {
    const mapped = mapSafetyViolationToDiagnostic(safety.violation.code);
    return toSafeDiagnostics({
      status: "error",
      message: mapped.message,
      suggestion: mapped.suggestion,
      fieldContext: `parametricSurface.${field}`
    });
  }

  const compiled = compileParametricSurfaceExpressions(xExpr, yExpr, zExpr, getEditorParameterScope());
  if (compiled.error) {
    return toSafeDiagnostics({
      status: "error",
      message: stripLabelPrefix(compiled.error),
      fieldContext: `parametricSurface.${field}`
    });
  }

  return { status: "valid", message: "", fieldContext: `parametricSurface.${field}` };
}

export function getImplicitSurfaceEquationDiagnostics(equation: string): ExpressionDiagnostic {
  const trimmed = equation.trim();
  if (!trimmed) {
    return { status: "error", message: "Invalid expression syntax.", fieldContext: "implicitSurface.equation" };
  }

  // Malformed equality (chained/comparison/missing side) reports up front
  // with the same grammar the compiler enforces.
  if (trimmed.includes("=")) {
    const parts = splitSingleMathEquality(trimmed);
    if (!parts) {
      return toSafeDiagnostics({
        status: "error",
        message: "Equation must contain exactly one '=' with expressions on both sides.",
        fieldContext: "implicitSurface.equation"
      });
    }
    for (const side of [parts.lhs, parts.rhs]) {
      const safety = validateExpressionSafety(side, {
        operation: "diagnostics-implicit-surface",
        expressionLabel: "Implicit surface equation",
        allowedSymbols: Object.keys(getEditorParameterScope())
      });
      if (!safety.ok) {
        const mapped = mapSafetyViolationToDiagnostic(safety.violation.code);
        return toSafeDiagnostics({
          status: "error",
          message: mapped.message,
          suggestion: mapped.suggestion,
          fieldContext: "implicitSurface.equation"
        });
      }
    }
  } else {
    const safety = validateExpressionSafety(trimmed, {
      operation: "diagnostics-implicit-surface",
      expressionLabel: "Implicit surface equation",
      allowedSymbols: Object.keys(getEditorParameterScope())
    });
    if (!safety.ok) {
      const mapped = mapSafetyViolationToDiagnostic(safety.violation.code);
      return toSafeDiagnostics({
        status: "error",
        message: mapped.message,
        suggestion: mapped.suggestion,
        fieldContext: "implicitSurface.equation"
      });
    }
  }

  const compiled = compileImplicitSurfaceExpression(equation, getEditorParameterScope());
  if (compiled.error) {
    return toSafeDiagnostics({
      status: "error",
      message: compiled.error,
      fieldContext: "implicitSurface.equation"
    });
  }

  return { status: "valid", message: "", fieldContext: "implicitSurface.equation" };
}

