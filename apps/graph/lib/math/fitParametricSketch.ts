/**
 * Fit a hand-drawn stroke (math plane coordinates) to a low-degree polynomial
 * in parameter t ∈ [0, 1] for each axis component, for use as x(t), y(t), z(t).
 */

export interface FitParametricSketchResult {
  horizontalCoeffs: number[];
  verticalCoeffs: number[];
  degree: number;
  maxError: number;
}

export interface FitParametricSketch3DResult {
  xCoeffs: number[];
  yCoeffs: number[];
  zCoeffs: number[];
  degree: number;
  maxError: number;
}

const DEFAULT_MAX_DEGREE = 10;
const MIN_POINTS = 4;

function buildVandermondeRow(t: number, degree: number): number[] {
  const row = new Array<number>(degree + 1);
  row[0] = 1;
  for (let j = 1; j <= degree; j += 1) {
    row[j] = row[j - 1] * t;
  }
  return row;
}

function accumulateNormalEquations(
  rows: number[][],
  targets: number[],
  degree: number
): { ata: number[][]; atb: number[] } {
  const n = degree + 1;
  const ata: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const atb = new Array<number>(n).fill(0);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const y = targets[i];
    for (let j = 0; j < n; j += 1) {
      atb[j] += row[j] * y;
      for (let k = 0; k < n; k += 1) {
        ata[j][k] += row[j] * row[k];
      }
    }
  }

  return { ata, atb };
}

function solveLinearSystem(ata: number[][], atb: number[]): number[] | null {
  const n = atb.length;
  const aug: number[][] = ata.map((row, i) => [...row, atb[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let pivotMag = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const v = Math.abs(aug[r][col]);
      if (v > pivotMag) {
        pivotMag = v;
        pivotRow = r;
      }
    }

    if (pivotMag < 1e-12) {
      return null;
    }

    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }

    const pivot = aug[col][col];
    for (let c = col; c <= n; c += 1) {
      aug[col][c] /= pivot;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) {
        continue;
      }
      for (let c = col; c <= n; c += 1) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  return aug.map((row) => row[n]);
}

function evaluatePoly(coeffs: number[], t: number): number {
  let sum = 0;
  let p = 1;
  for (let j = 0; j < coeffs.length; j += 1) {
    sum += coeffs[j] * p;
    p *= t;
  }
  return sum;
}

function resampleByArcLength(points: { horizontal: number; vertical: number }[], targetCount: number) {
  if (points.length < 2) {
    return points;
  }

  const dists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].horizontal - points[i - 1].horizontal;
    const dy = points[i].vertical - points[i - 1].vertical;
    const d = Math.hypot(dx, dy);
    total += d;
    dists.push(total);
  }

  if (total < 1e-12) {
    return [points[0]];
  }

  const out: { horizontal: number; vertical: number }[] = [];
  const count = Math.max(2, Math.min(targetCount, Math.floor(total * 500) + 2));

  for (let k = 0; k < count; k += 1) {
    const s = (k / (count - 1)) * total;
    let j = 0;
    while (j < dists.length - 1 && dists[j + 1] < s) {
      j += 1;
    }
    const s0 = dists[j];
    const s1 = dists[j + 1];
    const u = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    out.push({
      horizontal: points[j].horizontal + u * (points[j + 1].horizontal - points[j].horizontal),
      vertical: points[j].vertical + u * (points[j + 1].vertical - points[j].vertical)
    });
  }

  return out;
}

export function fitParametricSketch(
  rawPoints: { horizontal: number; vertical: number }[],
  options: {
    maxDegree?: number;
    relativeErrorTolerance?: number;
  } = {}
): FitParametricSketchResult | null {
  const maxDegree = options.maxDegree ?? DEFAULT_MAX_DEGREE;
  const relativeTolerance = options.relativeErrorTolerance ?? 0.025;

  if (rawPoints.length < MIN_POINTS) {
    return null;
  }

  const points = resampleByArcLength(rawPoints, 56);
  if (points.length < MIN_POINTS) {
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

  const maxD = Math.min(maxDegree, Math.max(1, m - 2));

  for (let degree = 1; degree <= maxD; degree += 1) {
    const rows = tValues.map((t) => buildVandermondeRow(t, degree));
    const hSystem = accumulateNormalEquations(rows, hTargets, degree);
    const vSystem = accumulateNormalEquations(rows, vTargets, degree);

    const hCoeffs = solveLinearSystem(hSystem.ata, hSystem.atb);
    const vCoeffs = solveLinearSystem(vSystem.ata, vSystem.atb);
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

    if (maxErr <= errorTol || degree === maxD) {
      return {
        horizontalCoeffs: hCoeffs,
        verticalCoeffs: vCoeffs,
        degree,
        maxError: maxErr
      };
    }
  }

  return null;
}

export function fitParametricSketch3d(
  rawPoints: { x: number; y: number; z: number }[],
  options: {
    maxDegree?: number;
    relativeErrorTolerance?: number;
  } = {}
): FitParametricSketch3DResult | null {
  const maxDegree = options.maxDegree ?? DEFAULT_MAX_DEGREE;
  const relativeTolerance = options.relativeErrorTolerance ?? 0.025;

  if (rawPoints.length < MIN_POINTS) {
    return null;
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
    const xSystem = accumulateNormalEquations(rows, xTargets, degree);
    const ySystem = accumulateNormalEquations(rows, yTargets, degree);
    const zSystem = accumulateNormalEquations(rows, zTargets, degree);
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

function formatCoefficientMagnitude(value: number): string {
  const mag = Math.abs(value);
  if (mag >= 1e4 || mag < 1e-3) {
    return mag.toExponential(6).replace(/e\+/g, "e");
  }
  const s = mag.toPrecision(8);
  return s.replace(/\.?0+$/, "");
}

export function formatPolynomialExpression(coeffs: number[], variable: string): string {
  let first = true;
  let expr = "";

  for (let j = 0; j < coeffs.length; j += 1) {
    const c = coeffs[j];
    if (!Number.isFinite(c) || Math.abs(c) < 1e-12) {
      continue;
    }

    const magStr = formatCoefficientMagnitude(c);
    const factor = j === 0 ? "" : j === 1 ? `*${variable}` : `*${variable}^${j}`;

    if (first) {
      expr = c < 0 ? `-${magStr}${factor}` : `${magStr}${factor}`;
      first = false;
      continue;
    }

    expr += c < 0 ? ` - ${magStr}${factor}` : ` + ${magStr}${factor}`;
  }

  return expr.length > 0 ? expr : "0";
}
