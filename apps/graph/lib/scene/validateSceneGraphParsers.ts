import type { GraphObject, ImplicitSurfaceObject, ParametricCurveObject, ParametricSurfaceObject, PlaneGraphObject, SurfaceGraphObject, VectorFieldObject } from "@vinculum/scene/types";
import {
  MAX_IMPLICIT_SURFACE_RESOLUTION,
  MAX_PARAMETRIC_SURFACE_RESOLUTION,
  MAX_SURFACE_RESOLUTION,
  MAX_VECTOR_FIELD_2D_DENSITY,
  MAX_VECTOR_FIELD_3D_DENSITY,
  MAX_VECTOR_FIELD_SCALE,
  MIN_IMPLICIT_SURFACE_RESOLUTION,
  MIN_PARAMETRIC_SURFACE_RESOLUTION,
  MIN_SURFACE_RESOLUTION,
  MIN_VECTOR_FIELD_DENSITY,
  MIN_VECTOR_FIELD_SCALE,
  normalizeImplicitSurfaceResolution,
  normalizeParametricSurfaceResolution,
  normalizeSurfaceResolution,
  normalizeVectorFieldDensity,
  normalizeVectorFieldScale
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
import { splitSingleMathEquality } from "@/lib/math/implicitEquation";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { getEffectiveSurfaceOrientation } from "@/lib/math/compileExpression";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

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

  if (kind === "parametricSurface") {
    return parseParametricSurfaceObject(rawObject, objectIndex, id, color, visible, errors);
  }

  if (kind === "implicitSurface") {
    return parseImplicitSurfaceObject(rawObject, objectIndex, id, color, visible, errors);
  }

  if (kind === "vectorField") {
    return parseVectorFieldObject(rawObject, objectIndex, id, color, visible, errors);
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
    // S10: the explicit-axis body may still be a supported implicit
    // equation (e.g. "1/x = 1") that no strip rule reduces. Accept it only
    // when the raw string is exactly one mathematical equality whose sides
    // independently satisfy expression safety; otherwise keep the original
    // explicit-path error. In particular a second "=" (chained equality or
    // "==") never splits, so `x = y = 1` still reports the explicit error.
    const parts = splitSingleMathEquality(equation);
    if (!parts) {
      errors.push(`objects[${objectIndex}].equation: ${safety.violation.message}`);
      return null;
    }
    const lhsSafety = validateExpressionSafety(parts.lhs, {
      operation: "validate-surface-expression",
      expressionLabel: "Surface equation",
      objectId: id,
      objectKind: "surface"
    });
    if (!lhsSafety.ok) {
      errors.push(`objects[${objectIndex}].equation: ${lhsSafety.violation.message}`);
      return null;
    }
    const rhsSafety = validateExpressionSafety(parts.rhs, {
      operation: "validate-surface-expression",
      expressionLabel: "Surface equation",
      objectId: id,
      objectKind: "surface"
    });
    if (!rhsSafety.ok) {
      errors.push(`objects[${objectIndex}].equation: ${rhsSafety.violation.message}`);
      return null;
    }
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

function parseParametricSurfaceObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): ParametricSurfaceObject | null {
  const xExpr = requireString(rawObject.xExpr, `objects[${objectIndex}].xExpr`, errors);
  const yExpr = requireString(rawObject.yExpr, `objects[${objectIndex}].yExpr`, errors);
  const zExpr = requireString(rawObject.zExpr, `objects[${objectIndex}].zExpr`, errors);

  const domainPath = `objects[${objectIndex}].domain`;
  if (!isRecord(rawObject.domain)) {
    errors.push(`${domainPath} must be an object.`);
    return null;
  }

  const uMin = parseFiniteNumber(rawObject.domain.uMin, `${domainPath}.uMin`, errors);
  const uMax = parseFiniteNumber(rawObject.domain.uMax, `${domainPath}.uMax`, errors);
  const vMin = parseFiniteNumber(rawObject.domain.vMin, `${domainPath}.vMin`, errors);
  const vMax = parseFiniteNumber(rawObject.domain.vMax, `${domainPath}.vMax`, errors);

  const resolution = parseInteger(
    rawObject.resolution,
    `objects[${objectIndex}].resolution`,
    errors,
    MIN_PARAMETRIC_SURFACE_RESOLUTION,
    MAX_PARAMETRIC_SURFACE_RESOLUTION
  );

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (!xExpr || !yExpr || !zExpr || uMin === null || uMax === null || vMin === null || vMax === null || resolution === null || wireframe === null) {
    return null;
  }

  // S17: mirror the parametric-curve parser — syntax/function/literal safety
  // per axis (u/v ride the compiler's allowed symbols; the parser checks
  // structure only). No finiteness probe: x = 1/u stays valid over domains
  // containing u = 0; pointwise validity belongs to the sampler.
  const axisSafety: Array<{ expr: string; label: string; path: string }> = [
    { expr: xExpr, label: "Parametric surface x(u,v)", path: `objects[${objectIndex}].xExpr` },
    { expr: yExpr, label: "Parametric surface y(u,v)", path: `objects[${objectIndex}].yExpr` },
    { expr: zExpr, label: "Parametric surface z(u,v)", path: `objects[${objectIndex}].zExpr` }
  ];
  for (const axis of axisSafety) {
    const safety = validateExpressionSafety(axis.expr, {
      operation: "validate-parametric-surface-expression",
      expressionLabel: axis.label,
      objectId: id,
      objectKind: "parametricSurface"
    });
    if (!safety.ok) {
      errors.push(`${axis.path}: ${safety.violation.message}`);
      return null;
    }
  }

  return {
    id,
    kind: "parametricSurface",
    xExpr,
    yExpr,
    zExpr,
    visible,
    color,
    domain: {
      uMin,
      uMax,
      vMin,
      vMax
    },
    resolution: normalizeParametricSurfaceResolution(resolution),
    appearance: {
      wireframe
    }
  };
}

function parseImplicitSurfaceObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): ImplicitSurfaceObject | null {
  const equation = requireString(rawObject.equation, `objects[${objectIndex}].equation`, errors);

  const domainPath = `objects[${objectIndex}].domain`;
  if (!isRecord(rawObject.domain)) {
    errors.push(`${domainPath} must be an object.`);
    return null;
  }

  const xMin = parseFiniteNumber(rawObject.domain.xMin, `${domainPath}.xMin`, errors);
  const xMax = parseFiniteNumber(rawObject.domain.xMax, `${domainPath}.xMax`, errors);
  const yMin = parseFiniteNumber(rawObject.domain.yMin, `${domainPath}.yMin`, errors);
  const yMax = parseFiniteNumber(rawObject.domain.yMax, `${domainPath}.yMax`, errors);
  const zMin = parseFiniteNumber(rawObject.domain.zMin, `${domainPath}.zMin`, errors);
  const zMax = parseFiniteNumber(rawObject.domain.zMax, `${domainPath}.zMax`, errors);

  const resolution = parseInteger(
    rawObject.resolution,
    `objects[${objectIndex}].resolution`,
    errors,
    MIN_IMPLICIT_SURFACE_RESOLUTION,
    MAX_IMPLICIT_SURFACE_RESOLUTION
  );

  const appearancePath = `objects[${objectIndex}].appearance`;
  if (!isRecord(rawObject.appearance)) {
    errors.push(`${appearancePath} must be an object.`);
    return null;
  }

  const wireframe = parseBoolean(rawObject.appearance.wireframe, `${appearancePath}.wireframe`, errors);

  if (
    !equation ||
    xMin === null ||
    xMax === null ||
    yMin === null ||
    yMax === null ||
    zMin === null ||
    zMax === null ||
    resolution === null ||
    wireframe === null
  ) {
    return null;
  }

  // S18: mirror the plane parser — chained/comparison equality is rejected
  // up front, then the authoritative field compiler performs the same
  // normalization, safety, and parameter-context checks as the live path.
  // Empty equations stay valid (editable-but-unrendered, like curves).
  const separatorCount = (equation.match(/=/g) ?? []).length;
  if (separatorCount > 1) {
    errors.push(`objects[${objectIndex}].equation: Equation must contain exactly one '='.`);
    return null;
  }
  if (equation.trim()) {
    const fieldCompiled = compileImplicitSurfaceExpression(equation, getEditorParameterScope());
    if (fieldCompiled.error) {
      errors.push(`objects[${objectIndex}].equation: ${fieldCompiled.error}`);
      return null;
    }
  }

  return {
    id,
    kind: "implicitSurface",
    equation,
    visible,
    color,
    domain: {
      xMin,
      xMax,
      yMin,
      yMax,
      zMin,
      zMax
    },
    resolution: normalizeImplicitSurfaceResolution(resolution),
    appearance: {
      wireframe
    }
  };
}

// S20: one canonical vectorField kind with a fixed dimension. Components
// use P/Q/R terminology. scale/normalize are render-only (never structure
// identity). Empty components reject at import (like parametric axes);
// the editor's transient empty creation state is handled downstream by the
// non-renderable path, never by the parser.
function parseVectorFieldObject(
  rawObject: Record<string, unknown>,
  objectIndex: number,
  id: string,
  color: string,
  visible: boolean,
  errors: string[]
): VectorFieldObject | null {
  const dimensionPath = `objects[${objectIndex}].dimension`;
  const dimensionRaw = rawObject.dimension;
  if (dimensionRaw !== "2d" && dimensionRaw !== "3d") {
    errors.push(`${dimensionPath} must be one of: 2d, 3d.`);
    return null;
  }
  const dimension = dimensionRaw;

  const pExpr = requireString(rawObject.pExpr, `objects[${objectIndex}].pExpr`, errors);
  const qExpr = requireString(rawObject.qExpr, `objects[${objectIndex}].qExpr`, errors);
  const rExpr = requireString(rawObject.rExpr, `objects[${objectIndex}].rExpr`, errors);

  const domainPath = `objects[${objectIndex}].domain`;
  if (!isRecord(rawObject.domain)) {
    errors.push(`${domainPath} must be an object.`);
    return null;
  }

  const xMin = parseFiniteNumber(rawObject.domain.xMin, `${domainPath}.xMin`, errors);
  const xMax = parseFiniteNumber(rawObject.domain.xMax, `${domainPath}.xMax`, errors);
  const yMin = parseFiniteNumber(rawObject.domain.yMin, `${domainPath}.yMin`, errors);
  const yMax = parseFiniteNumber(rawObject.domain.yMax, `${domainPath}.yMax`, errors);
  const zMin =
    dimension === "3d" ? parseFiniteNumber(rawObject.domain.zMin, `${domainPath}.zMin`, errors) : 0;
  const zMax =
    dimension === "3d" ? parseFiniteNumber(rawObject.domain.zMax, `${domainPath}.zMax`, errors) : 0;

  const density = parseInteger(
    rawObject.density,
    `objects[${objectIndex}].density`,
    errors,
    MIN_VECTOR_FIELD_DENSITY,
    dimension === "2d" ? MAX_VECTOR_FIELD_2D_DENSITY : MAX_VECTOR_FIELD_3D_DENSITY
  );

  let scale = parseFiniteNumber(rawObject.scale, `objects[${objectIndex}].scale`, errors);
  if (scale !== null && (scale < MIN_VECTOR_FIELD_SCALE || scale > MAX_VECTOR_FIELD_SCALE)) {
    errors.push(
      `objects[${objectIndex}].scale must be between ${MIN_VECTOR_FIELD_SCALE} and ${MAX_VECTOR_FIELD_SCALE}.`
    );
    scale = null;
  }

  const normalizeVectors = parseBoolean(rawObject.normalize, `objects[${objectIndex}].normalize`, errors);

  // Empty components reject explicitly (fail closed): unlike the silent
  // drop path, an import carrying an empty P/Q/R is malformed.
  let emptyComponent = false;
  if (typeof pExpr === "string" && !pExpr.trim()) {
    errors.push(`objects[${objectIndex}].pExpr cannot be empty.`);
    emptyComponent = true;
  }
  if (typeof qExpr === "string" && !qExpr.trim()) {
    errors.push(`objects[${objectIndex}].qExpr cannot be empty.`);
    emptyComponent = true;
  }
  if (dimension === "3d" && typeof rExpr === "string" && !rExpr.trim()) {
    errors.push(`objects[${objectIndex}].rExpr cannot be empty for dimension "3d".`);
    emptyComponent = true;
  }
  if (emptyComponent) {
    return null;
  }

  if (
    !pExpr ||
    !qExpr ||
    rExpr === null ||
    xMin === null ||
    xMax === null ||
    yMin === null ||
    yMax === null ||
    zMin === null ||
    zMax === null ||
    density === null ||
    scale === null ||
    normalizeVectors === null
  ) {
    return null;
  }

  // R belongs to 3D only: a 2D field carrying an R component is malformed
  // (fail closed rather than silently ignoring mathematics). 3D emptiness
  // is rejected above.
  if (dimension === "2d" && rExpr.trim() !== "") {
    errors.push(`objects[${objectIndex}].rExpr requires dimension "3d".`);
    return null;
  }

  // S11 safety per component, mirroring the parametric-surface parser:
  // syntax/function/literal structure only, no finiteness probe (P = 1/x
  // stays valid over domains containing x = 0; pointwise validity belongs
  // to the sampler). Full compiler checks run on the live path (Slice 2).
  const componentSafety: Array<{ expr: string; label: string; path: string }> = [
    { expr: pExpr, label: "Vector field P", path: `objects[${objectIndex}].pExpr` },
    { expr: qExpr, label: "Vector field Q", path: `objects[${objectIndex}].qExpr` },
    ...(dimension === "3d"
      ? [{ expr: rExpr, label: "Vector field R", path: `objects[${objectIndex}].rExpr` }]
      : [])
  ];
  for (const component of componentSafety) {
    const safety = validateExpressionSafety(component.expr, {
      operation: "validate-vector-field-expression",
      expressionLabel: component.label,
      objectId: id,
      objectKind: "vectorField"
    });
    if (!safety.ok) {
      errors.push(`${component.path}: ${safety.violation.message}`);
      return null;
    }
  }

  // Authoritative field compiler: same normalization, reserved-local, and
  // parameter-context checks as the live path, so unknown symbols (zzz)
  // and reserved locals (t) reject at import instead of arriving broken.
  const fieldCompiled = compileVectorFieldExpressions(
    dimension,
    pExpr,
    qExpr,
    rExpr,
    getEditorParameterScope()
  );
  if (fieldCompiled.error) {
    errors.push(`objects[${objectIndex}]: ${fieldCompiled.error}`);
    return null;
  }

  if (dimension === "2d") {
    return {
      id,
      kind: "vectorField",
      dimension: "2d",
      pExpr,
      qExpr,
      rExpr,
      visible,
      color,
      domain: { xMin, xMax, yMin, yMax },
      density: normalizeVectorFieldDensity(density, dimension),
      scale: normalizeVectorFieldScale(scale),
      normalize: normalizeVectors
    };
  }

  return {
    id,
    kind: "vectorField",
    dimension: "3d",
    pExpr,
    qExpr,
    rExpr,
    visible,
    color,
    domain: { xMin, xMax, yMin, yMax, zMin, zMax },
    density: normalizeVectorFieldDensity(density, dimension),
    scale: normalizeVectorFieldScale(scale),
    normalize: normalizeVectors
  };
}

function parsePlaneGraphObject(  rawObject: Record<string, unknown>,  objectIndex: number,
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

  // S10: plane persistence validation must match the live plane compiler.
  // Chained/comparison equality (`x = y = 1`, `x == 1`) is rejected up
  // front: mathematical plane grammar allows exactly one separator, and the
  // live probe evaluates assignments in scope, so the compiler alone would
  // otherwise accept chained forms. All other equations delegate to the
  // authoritative plane compiler, which performs the same normalization,
  // safety, coefficient-extraction, and linearity verification as the live
  // path (including its parameter context).
  const separatorCount = (equation.match(/=/g) ?? []).length;
  if (separatorCount > 1) {
    errors.push(`objects[${objectIndex}].equation: Equation must contain exactly one '='.`);
    return null;
  }
  const planeCompiled = compilePlaneEquation(equation);
  if (planeCompiled.error) {
    errors.push(`objects[${objectIndex}].equation: ${planeCompiled.error}`);
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

// S10: equation-syntax decomposition now lives in the shared pure helper
// splitSingleMathEquality (also used by the S18 implicit-surface compiler).
// It splits exactly one mathematical equality with non-empty sides and never
// decides whether the equation is a plane, implicit graph, or explicit
// surface. In particular `==` (two separators) never splits.
