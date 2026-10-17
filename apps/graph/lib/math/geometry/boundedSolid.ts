import type { IntegralComputeInput, IntegralComputeResult, IntegralExplicitSurfaceTarget } from "../calculus/computeIntegralData";
import { compileSurfaceExpression } from "../expressions/compileExpression";
import { getEffectiveSurfaceOrientation } from "../expressions/surfaceExpressionOrientation";
import { validateExpressionSafety } from "../expressions/expressionSafety";
import { compileExplicitSurfaceGeometry } from "../surfaces/surfaceGeometry";
import { surfaceArea } from "../calculus/surfaceIntegrals";
import { integrateSimpson1D, integrateSimpson2D, isQuadratureQuality, SIMPSON_1D_FINE_N, SIMPSON_2D_FINE_N } from "../calculus/simpsonQuadrature";
import { computeImplicitSurfaceData } from "../surfaces/computeImplicitSurfaceData";
import { compileParametricSurfaceExpressions } from "../expressions/compileParametricSurface";
import { sampleParametricSurface } from "../surfaces/sampleParametricSurface";
import { isContinuousSampleEdge } from "../curves/sampleContinuity";

const MAX_SOLID_TRIANGLES = 80_000;
const failure = (reason: string, status: IntegralComputeResult["status"] = "invalid"): IntegralComputeResult => ({ status, reason, value: NaN, coarseValue: NaN, estimatedError: NaN, convergenceWarning: false, evaluations: 0 });
type NumericEstimate = { value: number; coarseValue: number; estimatedError: number; evaluations: number };

function estimate(parts: NumericEstimate[]): IntegralComputeResult {
  const value = parts.reduce((sum, part) => sum + part.value, 0);
  const coarseValue = parts.reduce((sum, part) => sum + part.coarseValue, 0);
  const estimatedError = parts.reduce((sum, part) => sum + part.estimatedError, 0);
  if (![value, coarseValue, estimatedError].every(Number.isFinite)) return failure("A boundary is undefined or singular in the selected range. Restrict the range or edit the boundary.");
  return { status: "ok", value, coarseValue, estimatedError, evaluations: parts.reduce((sum, part) => sum + part.evaluations, 0), convergenceWarning: estimatedError > .005 * Math.max(Math.abs(value), 1e-12), reason: null };
}

/** Geometric volume and total boundary area between two finite height functions. */
function heightSolid(input: IntegralComputeInput, target: IntegralExplicitSurfaceTarget): IntegralComputeResult {
  const upper = getEffectiveSurfaceOrientation(target.equation, target.orientation);
  const lower = getEffectiveSurfaceOrientation(input.lowerBoundary ?? "0", upper.effectiveOrientation);
  if (lower.effectiveOrientation !== upper.effectiveOrientation) return failure("Both boundary functions must use the same output axis.");
  const variables = upper.effectiveOrientation === "x" ? ["y", "z"] : upper.effectiveOrientation === "y" ? ["x", "z"] : ["x", "y"];
  for (const body of [upper.body, lower.body]) {
    const safe = validateExpressionSafety(body, { operation: "bounded-solid", expressionLabel: "Boundary function", strictSymbols: true, allowedSymbols: [...variables, ...Object.keys(input.params).filter(key => !["x", "y", "z", "t", "u", "v"].includes(key))] });
    if (!safe.ok) return failure(safe.violation.message);
  }
  const f = compileSurfaceExpression(upper.body, upper.effectiveOrientation, input.params);
  const g = compileSurfaceExpression(lower.body, lower.effectiveOrientation, input.params);
  if (f.error || g.error) return failure(f.error ?? g.error!);
  const { xMin, xMax, yMin, yMax } = target.domain;
  const a = Math.min(xMin, xMax), b = Math.max(xMin, xMax), c = Math.min(yMin, yMax), d = Math.max(yMin, yMax);
  if (![a, b, c, d].every(Number.isFinite) || !(b > a && d > c)) return failure("Use a finite plot range with positive width and height.");
  // Numerical continuity screening rejects sampled jumps/poles before calling
  // a finite quadrature result a solid. It does not prove global boundedness.
  for (const evaluate of [f.evaluator, g.evaluator]) {
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
      const u = a + (b - a) * i / 8, v = c + (d - c) * j / 8;
      const value = evaluate(u, v);
      if (!Number.isFinite(value)) return failure("A boundary is undefined in the plot range. Restrict the range or edit the function.");
      if (i < 8) {
        const next = a + (b - a) * (i + 1) / 8;
        if (!isContinuousSampleEdge(t => evaluate(t, v), u, next, value, evaluate(next, v))) return failure("A boundary has a jump or singularity in this range. Use continuous finite boundaries or restrict the range.");
      }
      if (j < 8) {
        const next = c + (d - c) * (j + 1) / 8;
        if (!isContinuousSampleEdge(t => evaluate(u, t), v, next, value, evaluate(u, next))) return failure("A boundary has a jump or singularity in this range. Use continuous finite boundaries or restrict the range.");
      }
    }
  }
  const thickness = (u: number, v: number) => Math.abs(f.evaluator(u, v) - g.evaluator(u, v));
  const volume = integrateSimpson2D(thickness, a, b, c, d, SIMPSON_2D_FINE_N[input.quality]);
  if (input.mode === "volume" || volume.status !== "ok" || volume.value === 0) return estimate([volume]);
  const domain = { uMin: a, uMax: b, vMin: c, vMax: d };
  const top = surfaceArea(compileExplicitSurfaceGeometry(upper.body, upper.effectiveOrientation, input.params), domain, input.quality);
  const bottom = surfaceArea(compileExplicitSurfaceGeometry(lower.body, lower.effectiveOrientation, input.params), domain, input.quality);
  if (top.status !== "ok" || bottom.status !== "ok") return failure(top.reason ?? bottom.reason ?? "Boundary derivatives are unavailable.", top.status === "unsupported" || bottom.status === "unsupported" ? "unsupported" : "invalid");
  const n = SIMPSON_1D_FINE_N[input.quality];
  return estimate([top, bottom,
    integrateSimpson1D(u => thickness(u, c), a, b, n), integrateSimpson1D(u => thickness(u, d), a, b, n),
    integrateSimpson1D(v => thickness(a, v), c, d, n), integrateSimpson1D(v => thickness(b, v), c, d, n)]);
}

interface Mesh { positions: Float32Array; indices: Uint16Array | Uint32Array }
type MeshMeasure = { area: number; volume: number } | { error: string };

/** Weld parameter seams/poles, verify closed oriented edges, then sum triangles.
 * The samplers emit world coordinates; area and absolute volume are invariant
 * under that orthogonal axis permutation. Recentering avoids translation loss.
 */
export function measureSolidMesh(mesh: Mesh, requireClosed = true): MeshMeasure {
  if (mesh.positions.length % 3 !== 0 || mesh.indices.length % 3 !== 0) return { error: "Surface buffers do not contain complete vertices and triangles." };
  if (!mesh.indices.length) return { error: "No surface found in the plot range. Adjust the range or equation." };
  if (mesh.indices.length / 3 > MAX_SOLID_TRIANGLES) return { error: "Surface is too complex for solid analysis. Reduce quality or narrow the range." };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const index of mesh.indices) for (let axis = 0; axis < 3; axis++) {
    const coordinate = mesh.positions[index * 3 + axis];
    if (!Number.isFinite(coordinate)) return { error: "Surface coordinates are not finite." };
    min[axis] = Math.min(min[axis], coordinate); max[axis] = Math.max(max[axis], coordinate);
  }
  const center = min.map((value, axis) => value + (max[axis] - value) / 2);
  const span = Math.max(...max.map((value, axis) => value - min[axis]));
  if (!(span > 0)) return { error: "The surface is degenerate and does not enclose a solid." };
  const tolerance = span * 1e-6;
  const ids = new Uint32Array(mesh.positions.length / 3).fill(0xffffffff);
  const welded = new Map<string, number>(), points: number[][] = [];
  for (const index of mesh.indices) {
    if (ids[index] !== 0xffffffff) continue;
    const point = center.map((value, axis) => mesh.positions[index * 3 + axis] - value);
    const key = point.map(value => Math.round(value / tolerance)).join(",");
    let id = welded.get(key);
    if (id === undefined) { id = points.length; points.push(point); welded.set(key, id); }
    ids[index] = id;
  }
  const edges = new Map<string, { count: number; balance: number }>();
  let area = 0, signedVolume = 0, triangles = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = ids[mesh.indices[i]], b = ids[mesh.indices[i + 1]], c = ids[mesh.indices[i + 2]];
    if (a === b || b === c || c === a) continue;
    const p = points[a], q = points[b], r = points[c];
    const u = q.map((value, axis) => value - p[axis]), v = r.map((value, axis) => value - p[axis]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const twiceArea = Math.hypot(...cross);
    if (twiceArea <= tolerance * tolerance) continue;
    area += twiceArea / 2;
    signedVolume += (p[0] * cross[0] + p[1] * cross[1] + p[2] * cross[2]) / 6;
    triangles++;
    if (requireClosed) for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = `${Math.min(from, to)},${Math.max(from, to)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge);
    }
  }
  if (!triangles || !Number.isFinite(area) || !Number.isFinite(signedVolume)) return { error: "The sampled surface is degenerate or exceeds numeric limits." };
  if (requireClosed && [...edges.values()].some(edge => edge.count !== 2 || edge.balance !== 0)) return { error: "The surface is open, clipped, or inconsistently oriented. Enlarge the plot range or close the parameterization before computing volume." };
  return { area, volume: Math.abs(signedVolume) };
}

export function computeBoundedSolid(input: IntegralComputeInput): IntegralComputeResult {
  if (!isQuadratureQuality(input.quality)) return failure("Choose a supported analysis quality.");
  const target = input.target;
  if (target.kind === "surface") return heightSolid(input, target);
  if (target.kind !== "implicitSurface" && target.kind !== "parametricSurface") return failure("Select a surface to analyze a bounded solid.");
  if (input.mode === "solidArea") return failure("Boundary area between functions requires an explicit surface.");
  if (!Object.values(target.domain).every(Number.isFinite)) return failure("Use finite plot bounds.");
  const n = target.kind === "implicitSurface" ? { low: 16, medium: 32, high: 48 }[input.quality] : { low: 32, medium: 64, high: 128 }[input.quality];
  if (!n) return failure("Choose a supported analysis quality.");
  const position = target.kind === "parametricSurface" ? compileParametricSurfaceExpressions(target.xExpr, target.yExpr, target.zExpr, input.params) : null;
  if (position?.error) return failure(position.error);
  const measures: number[] = [];
  let evaluations = 0;
  for (const resolution of [n / 2, n]) {
    let mesh: Mesh;
    if (target.kind === "implicitSurface") {
      const computed = computeImplicitSurfaceData({ equation: target.equation, domain: target.domain, resolution, params: input.params, maxTriangles: MAX_SOLID_TRIANGLES });
      if (computed.status === "budget-exceeded") return failure("Surface exceeds the analysis budget. Reduce quality or narrow the plot range.", "budget-exceeded");
      if (computed.status !== "ok") return failure(computed.status === "error" ? computed.error : "No surface found in this range. Adjust the bounds or equation.");
      mesh = computed; evaluations += (resolution + 1) ** 3;
    } else {
      let invalid = false;
      mesh = sampleParametricSurface((u, v) => {
        const point = position!.evaluator(u, v);
        if (point.some(value => !Number.isFinite(value))) invalid = true;
        return point;
      }, { domain: target.domain, resolution, clampCoordinate: Number.MAX_VALUE });
      if (invalid) return failure("The parameterization is undefined in this range. Edit it or restrict the bounds.");
      evaluations += (resolution + 1) ** 2;
    }
    const measured = measureSolidMesh(mesh, input.mode === "volume");
    if ("error" in measured) return failure(measured.error);
    measures.push(input.mode === "volume" ? measured.volume : measured.area);
  }
  return estimate([{ value: measures[1], coarseValue: measures[0], estimatedError: Math.abs(measures[1] - measures[0]), evaluations }]);
}
