import type { GraphObject, ParametricCurveObject, PlaneGraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  MAX_SURFACE_RESOLUTION,
  MIN_SURFACE_RESOLUTION,
  normalizeSurfaceResolution
} from "@vinculum/scene/defaults";
import {
  isRecord,
  parseBoolean,
  parseColor,
  parseFiniteNumber,
  parseInteger,
  parseObjectKind,
  requireNonEmptyString,
  requireString
} from "./validateScenePrimitives";
import { MAX_PARAMETRIC_CURVE_SAMPLES, validateExpressionSafety } from "@/lib/math/expressionSafety";
import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";

export function parseGraphObject(rawObject: unknown, objectIndex: number, errors: string[]): GraphObject | null {
  if (!isRecord(rawObject)) {
    errors.push(`objects[${objectIndex}] must be an object.`);
    return null;
  }

  const id = requireNonEmptyString(rawObject.id, `objects[${objectIndex}].id`, errors);
  const kind = parseObjectKind(rawObject.kind, `objects[${objectIndex}].kind`, errors);
  const color = parseColor(rawObject.color, `objects[${objectIndex}].color`, errors);
  const visible = parseBoolean(rawObject.visible, `objects[${objectIndex}].visible`, errors);

  if (!id || !kind || !color || visible === null) {
    return null;
  }

  if (kind === "surface") {
    return parseSurfaceGraphObject(rawObject, objectIndex, id, color, visible, errors);
  }

  if (kind === "parametricCurve") {
    return parseParametricCurveObject(rawObject, objectIndex, id, color, visible, errors);
  }

  return parsePlaneGraphObject(rawObject, objectIndex, id, color, visible, errors);
}

function parseSurfaceGraphObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): SurfaceGraphObject | null {
  const equation = requireString(rawObject.equation, `objects[${objectIndex}].equation`, errors);
  const orientation = parseSurfaceOrientation(rawObject.orientation, `objects[${objectIndex}].orientation`, errors);

  const domainPath = `objects[${objectIndex}].domain`;
  if (!isRecord(rawObject.domain)) {
    errors.push(`${domainPath} must be an object.`);
    return null;
  }

  const xMin = parseFiniteNumber(rawObject.domain.xMin, `${domainPath}.xMin`, errors);
  const xMax = parseFiniteNumber(rawObject.domain.xMax, `${domainPath}.xMax`, errors);
  const yMin = parseFiniteNumber(rawObject.domain.yMin, `${domainPath}.yMin`, errors);
  const yMax = parseFiniteNumber(rawObject.domain.yMax, `${domainPath}.yMax`, errors);

  const resolution = parseInteger(
    rawObject.resolution,
    `objects[${objectIndex}].resolution`,
    errors,
    MIN_SURFACE_RESOLUTION,
    MAX_SURFACE_RESOLUTION
  );

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (!equation || xMin === null || xMax === null || yMin === null || yMax === null || resolution === null || wireframe === null) {
    return null;
  }

  const effectiveUiOrientation = orientation ?? "z";
  const { body } = getEffectiveSurfaceOrientation(equation, effectiveUiOrientation);
  if (!body) {
    errors.push(`objects[${objectIndex}].equation: Equation cannot be empty.`);
    return null;
  }

  const safety = validateExpressionSafety(body, {
    operation: "validate-surface-expression",
    expressionLabel: "Surface equation",
    objectId: id,
    objectKind: "surface"
  });
  if (!safety.ok) {
    errors.push(`objects[${objectIndex}].equation: ${safety.violation.message}`);
    return null;
  }

  return {
    id,
    kind: "surface",
    equation,
    visible,
    color,
    domain: {
      xMin,
      xMax,
      yMin,
      yMax
    },
    resolution: normalizeSurfaceResolution(resolution),
    appearance: {
      wireframe
    },
    orientation
  };
}

function parseParametricCurveObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): ParametricCurveObject | null {
  const xExpr = requireString(rawObject.xExpr, `objects[${objectIndex}].xExpr`, errors);
  const yExpr = requireString(rawObject.yExpr, `objects[${objectIndex}].yExpr`, errors);
  const zExpr = requireString(rawObject.zExpr, `objects[${objectIndex}].zExpr`, errors);
  const tMin = parseFiniteNumber(rawObject.tMin, `objects[${objectIndex}].tMin`, errors);
  const tMax = parseFiniteNumber(rawObject.tMax, `objects[${objectIndex}].tMax`, errors);
  const samples = parseInteger(rawObject.samples, `objects[${objectIndex}].samples`, errors, 2);

  if (!xExpr || !yExpr || !zExpr || tMin === null || tMax === null || samples === null) {
    return null;
  }

  if (samples > MAX_PARAMETRIC_CURVE_SAMPLES) {
    errors.push(`Resolution is too high. Use ${MAX_PARAMETRIC_CURVE_SAMPLES} or lower.`);
    return null;
  }

  const xSafety = validateExpressionSafety(xExpr, {
    operation: "validate-parametric-expression",
    expressionLabel: "Parametric x(t)",
    objectId: id,
    objectKind: "parametricCurve"
  });
  if (!xSafety.ok) {
    errors.push(`objects[${objectIndex}].xExpr: ${xSafety.violation.message}`);
    return null;
  }

  const ySafety = validateExpressionSafety(yExpr, {
    operation: "validate-parametric-expression",
    expressionLabel: "Parametric y(t)",
    objectId: id,
    objectKind: "parametricCurve"
  });
  if (!ySafety.ok) {
    errors.push(`objects[${objectIndex}].yExpr: ${ySafety.violation.message}`);
    return null;
  }

  const zSafety = validateExpressionSafety(zExpr, {
    operation: "validate-parametric-expression",
    expressionLabel: "Parametric z(t)",
    objectId: id,
    objectKind: "parametricCurve"
  });
  if (!zSafety.ok) {
    errors.push(`objects[${objectIndex}].zExpr: ${zSafety.violation.message}`);
    return null;
  }

  return {
    id,
    kind: "parametricCurve",
    xExpr,
    yExpr,
    zExpr,
    tMin,
    tMax,
    samples,
    color,
    visible
  };
}

function parsePlaneGraphObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): PlaneGraphObject | null {
  const equation = requireString(rawObject.equation, `objects[${objectIndex}].equation`, errors);
  const size = parseInteger(rawObject.size, `objects[${objectIndex}].size`, errors, 1);

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (!equation || size === null || wireframe === null) {
    return null;
  }

  const safety = validateExpressionSafety(equation, {
    operation: "validate-plane-expression",
    expressionLabel: "Plane equation",
    objectId: id,
    objectKind: "plane"
  });
  if (!safety.ok) {
    errors.push(`objects[${objectIndex}].equation: ${safety.violation.message}`);
    return null;
  }

  return {
    id,
    kind: "plane",
    equation,
    size,
    color,
    visible,
    appearance: {
      wireframe
    }
  };
}

function parseSurfaceOrientation(
  value: unknown,
  path: string,
  errors: string[]
): "z" | "y" | "x" | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === "x" || value === "y" || value === "z") {
    return value;
  }

  errors.push(`${path} must be one of: x, y, z.`);
  return undefined;
}
