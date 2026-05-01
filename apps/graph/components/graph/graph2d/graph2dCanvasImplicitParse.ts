export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitImplicitEquation(expression: string): { lhs: string; rhs: string } | null {
  const trimmed = expression.trim();
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex < 0) {
    return null;
  }
  if (trimmed.indexOf("=", eqIndex + 1) !== -1) {
    return null;
  }
  const lhs = trimmed.slice(0, eqIndex).trim() || "0";
  const rhs = trimmed.slice(eqIndex + 1).trim() || "0";
  return {
    lhs,
    rhs
  };
}
