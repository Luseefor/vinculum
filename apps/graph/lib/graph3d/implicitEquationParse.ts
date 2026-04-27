export function splitImplicitEquation(equation: string): { left: string; right: string } | null {
  const trimmed = equation.trim();
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex < 0) {
    return null;
  }
  if (trimmed.indexOf("=", eqIndex + 1) !== -1) {
    return null;
  }
  const left = trimmed.slice(0, eqIndex).trim() || "0";
  const right = trimmed.slice(eqIndex + 1).trim() || "0";
  const explicitAxisAssign = /^[xyz]\s*=/i.test(trimmed);
  if (explicitAxisAssign) {
    return null;
  }
  return { left, right };
}

export function getUsedAxes(expression: string): ("x" | "y" | "z")[] {
  const matches = expression.match(/\b[xyz]\b/gi) ?? [];
  const set = new Set<"x" | "y" | "z">();
  for (const match of matches) {
    const axis = match.toLowerCase();
    if (axis === "x" || axis === "y" || axis === "z") {
      set.add(axis);
    }
  }
  return [...set];
}

export function interpolateImplicitEdge(
  u1: number,
  v1: number,
  f1: number,
  u2: number,
  v2: number,
  f2: number
): { u: number; v: number } | null {
  if (!Number.isFinite(f1) || !Number.isFinite(f2)) {
    return null;
  }
  if (Math.abs(f1 - f2) < 1e-12) {
    return { u: (u1 + u2) * 0.5, v: (v1 + v2) * 0.5 };
  }
  const t = Math.min(1, Math.max(0, f1 / (f1 - f2)));
  return {
    u: u1 + (u2 - u1) * t,
    v: v1 + (v2 - v1) * t
  };
}

export function mapMathToWorldFromAxes(
  uAxis: "x" | "y" | "z",
  vAxis: "x" | "y" | "z",
  fixedAxis: "x" | "y" | "z",
  u: number,
  v: number,
  fixedValue = 0
): { x: number; y: number; z: number } {
  const math = { x: 0, y: 0, z: 0 };
  math[uAxis] = u;
  math[vAxis] = v;
  math[fixedAxis] = fixedValue;
  return {
    x: math.x,
    y: math.z,
    z: math.y
  };
}
