export const FIT_PARAMETRIC_SKETCH_DEFAULT_MAX_DEGREE = 8;
export const FIT_PARAMETRIC_SKETCH_MIN_POINTS = 4;
export const FIT_PARAMETRIC_SKETCH_DEFAULT_RIDGE = 1e-10;

export function buildVandermondeRow(t: number, degree: number): number[] {
  const row = new Array<number>(degree + 1);
  row[0] = 1;
  for (let j = 1; j <= degree; j += 1) {
    row[j] = row[j - 1] * t;
  }
  return row;
}

export function accumulateNormalEquations(
  rows: number[][],
  targets: number[],
  degree: number,
  ridge = FIT_PARAMETRIC_SKETCH_DEFAULT_RIDGE
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

  for (let i = 0; i < n; i += 1) {
    ata[i][i] += ridge;
  }

  return { ata, atb };
}

export function solveLinearSystem(ata: number[][], atb: number[]): number[] | null {
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

export function evaluatePoly(coeffs: number[], t: number): number {
  let sum = 0;
  let p = 1;
  for (let j = 0; j < coeffs.length; j += 1) {
    sum += coeffs[j] * p;
    p *= t;
  }
  return sum;
}
