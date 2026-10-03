/**
 * Fit mathematical-plane strokes to recognizable curves, falling back to
 * bounded freehand expressions when a polynomial cannot preserve the shape.
 */

import { cleanSketchCoefficients, recognizeSketchShape, simplifySketchStroke, sketchPolylineExpression } from "./fitParametricSketchShapes";
import { formatPolynomialExpression } from "./fitParametricSketchFormat";

import {
  accumulateNormalEquations,
  buildVandermondeRow,
  evaluatePoly,
  FIT_PARAMETRIC_SKETCH_DEFAULT_MAX_DEGREE,
  FIT_PARAMETRIC_SKETCH_DEFAULT_RIDGE,
  FIT_PARAMETRIC_SKETCH_MIN_POINTS,
  solveLinearSystem
} from "./fitParametricSketchPolyCore";
import { resampleStrokeByArcLength, smoothStrokePoints } from "./fitParametricSketchStrokePrep";
import type { FitParametricSketch3DResult, FitParametricSketchResult } from "./fitParametricSketchTypes";

export type { FitParametricSketch3DResult, FitParametricSketchResult } from "./fitParametricSketchTypes";

export { formatPolynomialExpression } from "./fitParametricSketchFormat";

export function fitParametricSketch(
  rawPoints: { horizontal: number; vertical: number }[],
  options: {
    maxDegree?: number;
    relativeErrorTolerance?: number;
    ridge?: number;
    smoothPasses?: number;
  } = {}
): FitParametricSketchResult | null {
  const maxDegree = options.maxDegree ?? FIT_PARAMETRIC_SKETCH_DEFAULT_MAX_DEGREE;
  const relativeTolerance = options.relativeErrorTolerance ?? 0.008;
  const ridge = options.ridge ?? FIT_PARAMETRIC_SKETCH_DEFAULT_RIDGE;
  const smoothPasses = options.smoothPasses ?? 0;

  if (rawPoints.length < FIT_PARAMETRIC_SKETCH_MIN_POINTS || rawPoints.some(p => !Object.values(p).every(Number.isFinite))) {
    return null;
  }

  const points = smoothStrokePoints(resampleStrokeByArcLength(rawPoints, 72), smoothPasses);
  if (points.length < FIT_PARAMETRIC_SKETCH_MIN_POINTS) {
    return null;
  }

  const m = points.length;
  const tValues = points.map((_, i) => (m === 1 ? 0 : i / (m - 1)));
  const hTargets = points.map((p) => p.horizontal);
  const vTargets = points.map((p) => p.vertical);

  let hMin = hTargets[0];
  let hMax = hTargets[0];
  let vMin = vTargets[0];
  let vMax = vTargets[0];
  for (let i = 1; i < m; i += 1) {
    hMin = Math.min(hMin, hTargets[i]);
    hMax = Math.max(hMax, hTargets[i]);
    vMin = Math.min(vMin, vTargets[i]);
    vMax = Math.max(vMax, vTargets[i]);
  }

  const diag = Math.hypot(Math.max(hMax - hMin, 1e-9), Math.max(vMax - vMin, 1e-9));
  const errorTol = relativeTolerance * diag;

  const recognized = recognizeSketchShape(rawPoints, Math.max(errorTol, diag * 0.015));
  if (recognized) return recognized;

  const maxD = Math.min(maxDegree, Math.max(1, m - 2));

  for (let degree = 1; degree <= maxD; degree += 1) {
    const rows = tValues.map((t) => buildVandermondeRow(t, degree));
    const hSystem = accumulateNormalEquations(rows, hTargets, degree, ridge);
    const vSystem = accumulateNormalEquations(rows, vTargets, degree, ridge);

    const hRaw = solveLinearSystem(hSystem.ata, hSystem.atb);
    const hCoeffs = hRaw ? cleanSketchCoefficients(hRaw) : null;
    const vRaw = solveLinearSystem(vSystem.ata, vSystem.atb);
    const vCoeffs = vRaw ? cleanSketchCoefficients(vRaw) : null;
    if (!hCoeffs || !vCoeffs) {
      continue;
    }

    let maxErr = 0;
    for (let i = 0; i < m; i += 1) {
      const th = evaluatePoly(hCoeffs, tValues[i]);
      const tv = evaluatePoly(vCoeffs, tValues[i]);
      const err = Math.hypot(th - hTargets[i], tv - vTargets[i]);
      maxErr = Math.max(maxErr, err);
    }

    if (maxErr <= errorTol) {
      return {
        horizontalExpr: formatPolynomialExpression(hCoeffs, "t"),
        verticalExpr: formatPolynomialExpression(vCoeffs, "t"),
        shape: "polynomial",
        horizontalCoeffs: hCoeffs,
        verticalCoeffs: vCoeffs,
        degree,
        maxError: maxErr
      };
    }
  }

  const fallback = simplifySketchStroke(rawPoints, errorTol);
  return { horizontalCoeffs: [], verticalCoeffs: [], degree: 0,
    shape: "freehand", maxError: fallback.maxError,
    horizontalExpr: sketchPolylineExpression(fallback.points.map(p => p.horizontal)),
    verticalExpr: sketchPolylineExpression(fallback.points.map(p => p.vertical)) };
}

export function fitParametricSketch3d(
  rawPoints: { x: number; y: number; z: number }[],
  options: {
    maxDegree?: number;
    relativeErrorTolerance?: number;
    ridge?: number;
  } = {}
): FitParametricSketch3DResult | null {
  const maxDegree = options.maxDegree ?? FIT_PARAMETRIC_SKETCH_DEFAULT_MAX_DEGREE;
  const relativeTolerance = options.relativeErrorTolerance ?? 0.008;
  const ridge = options.ridge ?? FIT_PARAMETRIC_SKETCH_DEFAULT_RIDGE;

  if (rawPoints.length < FIT_PARAMETRIC_SKETCH_MIN_POINTS || rawPoints.some(p => !Object.values(p).every(Number.isFinite))) {
    return null;
  }

  for (const fixed of ["x", "y", "z"] as const) {
    if (!rawPoints.every(p => Math.abs(p[fixed] - rawPoints[0][fixed]) < 1e-8)) continue;
    const axes = (["x", "y", "z"] as const).filter(axis => axis !== fixed);
    const fit = fitParametricSketch(rawPoints.map(p => ({ horizontal: p[axes[0]], vertical: p[axes[1]] })), options);
    if (!fit) return null;
    const coeffs = { [fixed]: [rawPoints[0][fixed]], [axes[0]]: fit.horizontalCoeffs, [axes[1]]: fit.verticalCoeffs };
    const exprs = { [fixed]: formatPolynomialExpression([rawPoints[0][fixed]], "t"), [axes[0]]: fit.horizontalExpr, [axes[1]]: fit.verticalExpr };
    return { xCoeffs: coeffs.x, yCoeffs: coeffs.y, zCoeffs: coeffs.z,
      xExpr: exprs.x, yExpr: exprs.y, zExpr: exprs.z, degree: fit.degree, maxError: fit.maxError };
  }

  const m = rawPoints.length;
  const tValues = rawPoints.map((_, i) => (m === 1 ? 0 : i / (m - 1)));
  const xTargets = rawPoints.map((p) => p.x);
  const yTargets = rawPoints.map((p) => p.y);
  const zTargets = rawPoints.map((p) => p.z);

  let xMin = xTargets[0];
  let xMax = xTargets[0];
  let yMin = yTargets[0];
  let yMax = yTargets[0];
  let zMin = zTargets[0];
  let zMax = zTargets[0];
  for (let i = 1; i < m; i += 1) {
    xMin = Math.min(xMin, xTargets[i]);
    xMax = Math.max(xMax, xTargets[i]);
    yMin = Math.min(yMin, yTargets[i]);
    yMax = Math.max(yMax, yTargets[i]);
    zMin = Math.min(zMin, zTargets[i]);
    zMax = Math.max(zMax, zTargets[i]);
  }

  const diag = Math.hypot(
    Math.max(xMax - xMin, 1e-9),
    Math.max(yMax - yMin, 1e-9),
    Math.max(zMax - zMin, 1e-9)
  );
  const errorTol = relativeTolerance * diag;
  const maxD = Math.min(maxDegree, Math.max(1, m - 2));

  for (let degree = 1; degree <= maxD; degree += 1) {
    const rows = tValues.map((t) => buildVandermondeRow(t, degree));
    const xSystem = accumulateNormalEquations(rows, xTargets, degree, ridge);
    const ySystem = accumulateNormalEquations(rows, yTargets, degree, ridge);
    const zSystem = accumulateNormalEquations(rows, zTargets, degree, ridge);
    const xCoeffs = solveLinearSystem(xSystem.ata, xSystem.atb);
    const yCoeffs = solveLinearSystem(ySystem.ata, ySystem.atb);
    const zCoeffs = solveLinearSystem(zSystem.ata, zSystem.atb);
    if (!xCoeffs || !yCoeffs || !zCoeffs) {
      continue;
    }

    let maxErr = 0;
    for (let i = 0; i < m; i += 1) {
      const fx = evaluatePoly(xCoeffs, tValues[i]);
      const fy = evaluatePoly(yCoeffs, tValues[i]);
      const fz = evaluatePoly(zCoeffs, tValues[i]);
      const err = Math.hypot(fx - xTargets[i], fy - yTargets[i], fz - zTargets[i]);
      maxErr = Math.max(maxErr, err);
    }

    if (maxErr <= errorTol || degree === maxD) {
      return {
        xCoeffs,
        yCoeffs,
        zCoeffs,
        degree,
        maxError: maxErr
      };
    }
  }

  return null;
}
