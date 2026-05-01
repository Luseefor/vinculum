export function formatNumber(n: number): string {
  if (Math.abs(n) < 1e-10) {
    return "0";
  }
  if (Math.abs(n) >= 1000 || Math.abs(n) < 0.001) {
    return n.toExponential(1);
  }
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0
  });
}

export function formatCoord(n: number): string {
  if (Math.abs(n) < 1e-10) {
    return "0";
  }
  if (Math.abs(n) >= 10000 || Math.abs(n) < 0.001) {
    return n.toExponential(2);
  }
  return parseFloat(n.toFixed(4)).toString();
}

export function formatProbeCoord(n: number): string {
  if (!Number.isFinite(n)) {
    return "NaN";
  }
  if (Math.abs(n) < 1e-10) {
    return "0";
  }
  if (Math.abs(n) >= 10000 || Math.abs(n) < 0.001) {
    return n.toExponential(3);
  }
  return parseFloat(n.toFixed(4)).toString();
}
