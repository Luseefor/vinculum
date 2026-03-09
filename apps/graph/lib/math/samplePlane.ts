import { compile } from "mathjs";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

export interface PlaneCoefficients {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface CompiledPlaneEquation {
  coefficients: PlaneCoefficients | null;
  error: string | null;
}

export interface SampledPlaneMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

const MAX_ERROR_LENGTH = 92;

export function compilePlaneEquation(equation: string): CompiledPlaneEquation {
  const normalized = normalizePlaneEquation(equation);
  if (normalized.error) {
    return { coefficients: null, error: normalized.error };
  }

  let compiledExpression: CompiledMathExpression;
  try {
    compiledExpression = compile(normalized.expression) as CompiledMathExpression;
  } catch (error) {
    return {
      coefficients: null,
      error: formatPlaneError(error)
    };
  }

  const d = evaluateExpression(compiledExpression, 0, 0, 0);
  const fx = evaluateExpression(compiledExpression, 1, 0, 0);
  const fy = evaluateExpression(compiledExpression, 0, 1, 0);
  const fz = evaluateExpression(compiledExpression, 0, 0, 1);

  if (![d, fx, fy, fz].every(Number.isFinite)) {
    return {
      coefficients: null,
      error: "Equation could not be evaluated."
    };
  }

  const coefficients: PlaneCoefficients = {
    a: fx - d,
    b: fy - d,
    c: fz - d,
    d
  };

  const normalMagnitude = Math.hypot(coefficients.a, coefficients.b, coefficients.c);
  if (normalMagnitude < 1e-8) {
    return {
      coefficients: null,
      error: "Plane normal cannot be zero."
    };
  }

  const linearityCheck = evaluateExpression(compiledExpression, 2, -1, 0.5);
  const expected =
    coefficients.a * 2 +
    coefficients.b * -1 +
    coefficients.c * 0.5 +
    coefficients.d;

  if (!Number.isFinite(linearityCheck) || Math.abs(linearityCheck - expected) > 1e-4) {
    return {
      coefficients: null,
      error: "Equation must be linear in x, y, z."
    };
  }

  return {
    coefficients,
    error: null
  };
}

export function samplePlane(coefficients: PlaneCoefficients, size: number): SampledPlaneMesh {
  const halfSize = Math.max(1, size) / 2;

  const normal = [coefficients.a, coefficients.b, coefficients.c] as const;
  const normalLengthSquared =
    normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2];

  const center = [
    (-coefficients.d * normal[0]) / normalLengthSquared,
    (-coefficients.d * normal[1]) / normalLengthSquared,
    (-coefficients.d * normal[2]) / normalLengthSquared
  ] as const;

  const normalUnit = normalizeVector(normal[0], normal[1], normal[2]);
  const axis = Math.abs(normalUnit[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];

  const tangentA = normalizeVector(...cross(axis[0], axis[1], axis[2], normalUnit[0], normalUnit[1], normalUnit[2]));
  const tangentB = normalizeVector(...cross(normalUnit[0], normalUnit[1], normalUnit[2], tangentA[0], tangentA[1], tangentA[2]));

  const corners = [
    addVectors(center, scaleVector(addVectors(tangentA, tangentB), halfSize)),
    addVectors(center, scaleVector(addVectors(negateVector(tangentA), tangentB), halfSize)),
    addVectors(center, scaleVector(addVectors(negateVector(tangentA), negateVector(tangentB)), halfSize)),
    addVectors(center, scaleVector(addVectors(tangentA, negateVector(tangentB)), halfSize))
  ];

  const positions = new Float32Array([
    corners[0][0],
    corners[0][1],
    corners[0][2],
    corners[1][0],
    corners[1][1],
    corners[1][2],
    corners[2][0],
    corners[2][1],
    corners[2][2],
    corners[3][0],
    corners[3][1],
    corners[3][2]
  ]);

  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

  return { positions, indices };
}

function normalizePlaneEquation(equation: string): { expression: string; error: string | null } {
  const trimmed = equation.trim();
  if (!trimmed) {
    return {
      expression: "",
      error: "Plane equation cannot be empty."
    };
  }

  const equalIndex = trimmed.indexOf("=");
  if (equalIndex === -1) {
    return {
      expression: trimmed,
      error: null
    };
  }

  const left = trimmed.slice(0, equalIndex).trim();
  const right = trimmed.slice(equalIndex + 1).trim();

  if (!left || !right) {
    return {
      expression: "",
      error: "Plane equation must include both sides of '='."
    };
  }

  return {
    expression: `(${left}) - (${right})`,
    error: null
  };
}

function evaluateExpression(expression: CompiledMathExpression, x: number, y: number, z: number): number {
  try {
    const value = expression.evaluate({ x, y, z });
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function formatPlaneError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const firstLine = error.message.split("\n")[0]?.trim() ?? "Invalid plane equation.";
    const compact = firstLine.replace(/^Error:\s*/i, "");
    if (compact.length <= MAX_ERROR_LENGTH) {
      return compact;
    }

    return `${compact.slice(0, MAX_ERROR_LENGTH - 1)}…`;
  }

  return "Invalid plane equation.";
}

type Vector3 = [number, number, number];

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): Vector3 {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx
  ];
}

function normalizeVector(x: number, y: number, z: number): Vector3 {
  const length = Math.hypot(x, y, z);
  if (length <= 1e-8) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

function addVectors(a: Readonly<Vector3>, b: Readonly<Vector3>): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function negateVector(v: Readonly<Vector3>): Vector3 {
  return [-v[0], -v[1], -v[2]];
}

function scaleVector(v: Readonly<Vector3>, scalar: number): Vector3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}
