import { accumulateNormalEquations, buildVandermondeRow, evaluatePoly, solveLinearSystem } from "./fitParametricSketchPolyCore";
import { formatPolynomialExpression } from "./fitParametricSketchFormat";
import type { FitParametricSketchResult } from "./fitParametricSketchTypes";

type Point = { horizontal: number; vertical: number };
const number = (value: number) => String(Number(value.toPrecision(6)));

/** Snap numerical fitting noise only when the rounded model still matches the stroke. */
export function cleanSketchCoefficients(coeffs: number[]): number[] {
  return coeffs.map(value => {
    const rounded = Math.round(value * 100) / 100;
    return Math.abs(value - rounded) < 0.0001 * Math.max(1, Math.abs(value)) ? rounded : Number(value.toPrecision(6));
  });
}

export function recognizeSketchShape(points: Point[], tolerance: number): FitParametricSketchResult | null {
  // Use a coordinate parameter for function-shaped strokes; arc-length polynomials
  // otherwise turn even a parabola into two long, unrelated expressions.
  for (const swap of [false, true]) {
    const input = points.map(p => swap ? p.vertical : p.horizontal);
    const output = points.map(p => swap ? p.horizontal : p.vertical);
    const start = input[0];
    const span = input[input.length - 1] - start;
    if (Math.abs(span) < tolerance) continue;
    if (input.some((v, i) => i > 0 && (v - input[i - 1]) * Math.sign(span) < -tolerance)) continue;
    const times = input.map(v => (v - start) / span);
    for (let degree = 1; degree <= 3; degree++) {
      const system = accumulateNormalEquations(times.map(t => buildVandermondeRow(t, degree)), output, degree);
      const raw = solveLinearSystem(system.ata, system.atb);
      if (!raw) continue;
      const coeffs = cleanSketchCoefficients(raw);
      const error = Math.max(...times.map((t, i) => Math.abs(evaluatePoly(coeffs, t) - output[i])));
      if (error > tolerance) continue;
      const independent = cleanSketchCoefficients([start, span]);
      // Include rounding error in acceptance, especially for translated strokes.
      if (Math.max(...times.map((t, i) => Math.hypot(evaluatePoly(independent, t) - input[i], evaluatePoly(coeffs, t) - output[i]))) > tolerance) continue;
      const horizontalCoeffs = swap ? coeffs : independent;
      const verticalCoeffs = swap ? independent : coeffs;
      return { horizontalCoeffs, verticalCoeffs,
        horizontalExpr: formatPolynomialExpression(horizontalCoeffs, "t"),
        verticalExpr: formatPolynomialExpression(verticalCoeffs, "t"),
        degree, maxError: error, shape: degree === 1 ? "line" : degree === 2 ? "parabola" : "cubic" };
    }
  }

  // A centered least-squares circle avoids instability for drawings far from zero.
  const ox = points.reduce((s, p) => s + p.horizontal, 0) / points.length;
  const oy = points.reduce((s, p) => s + p.vertical, 0) / points.length;
  const rows = points.map(p => [1, p.horizontal - ox, p.vertical - oy]);
  const targets = points.map(p => (p.horizontal - ox) ** 2 + (p.vertical - oy) ** 2);
  const system = accumulateNormalEquations(rows, targets, 2);
  const circle = solveLinearSystem(system.ata, system.atb);
  if (!circle) return null;
  const cx = ox + circle[1] / 2, cy = oy + circle[2] / 2;
  const radius = Math.sqrt(circle[0] + (circle[1] ** 2 + circle[2] ** 2) / 4);
  if (!Number.isFinite(radius) || radius <= tolerance) return null;
  const error = Math.max(...points.map(p => Math.abs(Math.hypot(p.horizontal - cx, p.vertical - cy) - radius)));
  if (error > tolerance) return null;
  const angles = points.map(p => Math.atan2(p.vertical - cy, p.horizontal - cx));
  for (let i = 1; i < angles.length; i++) {
    while (angles[i] - angles[i - 1] > Math.PI) angles[i] -= 2 * Math.PI;
    while (angles[i] - angles[i - 1] < -Math.PI) angles[i] += 2 * Math.PI;
  }
  const arc = angles[angles.length - 1] - angles[0];
  if (Math.abs(arc) < Math.PI / 3 || angles.some((a, i) => i > 0 && (a - angles[i - 1]) * Math.sign(arc) < -0.05)) return null;
  const angle = formatPolynomialExpression([angles[0], arc], "t");
  return { horizontalCoeffs: [], verticalCoeffs: [], degree: 0, maxError: error, shape: "circle",
    horizontalExpr: `${number(cx)} + ${number(radius)}*cos(${angle})`,
    verticalExpr: `${number(cy)} + ${number(radius)}*sin(${angle})` };
}

/** Bounded piecewise-linear expression using supported abs(), preserving corners. */
export function sketchPolylineExpression(values: number[]): string {
  const n = values.length - 1;
  const slopes = values.slice(1).map((value, i) => (value - values[i]) * n);
  let expression = `${number(values[0])} + ${number(slopes[0])}*t`;
  for (let i = 1; i < n; i++) {
    const change = (slopes[i] - slopes[i - 1]) / 2;
    if (Math.abs(change) < 1e-8) continue;
    const knot = number(i / n);
    expression += ` + ${number(change)}*(t-${knot}+abs(t-${knot}))`;
  }
  return expression;
}

export function simplifySketchStroke(points: Point[], tolerance: number): { points: Point[]; maxError: number } {
  const indices = [0, points.length - 1];
  let maxError = 0;
  while (indices.length < 28) {
    maxError = 0;
    let next = -1;
    for (let k = 1; k < indices.length; k++) {
      const a = points[indices[k - 1]], b = points[indices[k]];
      const dx = b.horizontal - a.horizontal, dy = b.vertical - a.vertical;
      const norm = dx * dx + dy * dy;
      for (let i = indices[k - 1] + 1; i < indices[k]; i++) {
        const p = points[i];
        const t = norm ? Math.max(0, Math.min(1, ((p.horizontal - a.horizontal) * dx + (p.vertical - a.vertical) * dy) / norm)) : 0;
        const error = Math.hypot(p.horizontal - a.horizontal - t * dx, p.vertical - a.vertical - t * dy);
        if (error > maxError) { maxError = error; next = i; }
      }
    }
    if (maxError <= tolerance || next < 0) break;
    indices.push(next);
    indices.sort((a, b) => a - b);
  }
  return { points: indices.map(i => points[i]), maxError };
}
