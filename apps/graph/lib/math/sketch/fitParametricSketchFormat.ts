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
    const term = j > 0 && magStr === "1" ? factor.slice(1) : `${magStr}${factor}`;

    if (first) {
      expr = c < 0 ? `-${term}` : term;
      first = false;
      continue;
    }

    expr += c < 0 ? ` - ${term}` : ` + ${term}`;
  }

  return expr.length > 0 ? expr : "0";
}
