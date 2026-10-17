import { MAX_EXPRESSION_LENGTH } from "./expressionSafety";

/** Convert cases notation to the existing bounded conditional expression grammar. */
export function normalizePiecewiseExpression(source: string): string {
  if (source.length > MAX_EXPRESSION_LENGTH) throw new Error("Expression is too long.");
  let result = source;
  for (let pass = 0; result.includes("{"); pass++) {
    if (pass >= 32) throw new Error("Use at most 32 piecewise groups.");
    const start = result.lastIndexOf("{");
    const end = result.indexOf("}", start);
    if (end < 0) throw new Error("Close the piecewise function with '}'.");
    const body = result.slice(start + 1, end);
    const rows: string[] = [];
    let depth = 0, offset = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "(") depth++;
      if (body[i] === ")") depth--;
      if (depth === 0 && /[,;\n]/.test(body[i]!)) { rows.push(body.slice(offset, i).trim()); offset = i + 1; }
    }
    rows.push(body.slice(offset).trim());
    if (!rows.length || rows.length > 16 || rows.some(row => !row)) throw new Error("Use 1–16 cases, separated by ';'.");
    let expression = "(0/0)";
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]!;
      const written = row.match(/^(.+?)\s+(?:for|if)\s+(.+)$/i);
      const colon = row.indexOf(":");
      const fallback = row.match(/^(.+?)\s+otherwise$/i);
      if (fallback || /^otherwise\s*:/i.test(row)) {
        if (i !== rows.length - 1) throw new Error("Put 'otherwise' in the last case.");
        expression = `(${fallback ? fallback[1] : row.slice(colon + 1)})`;
      } else {
        const value = written?.[1] ?? (colon >= 0 ? row.slice(colon + 1) : null);
        const condition = written?.[2] ?? (colon >= 0 ? row.slice(0, colon) : null);
        if (!value?.trim() || !condition?.trim()) throw new Error("Write each case as '0 for t<0' or 't<0:0'.");
        expression = `((${condition}) ? (${value}) : ${expression})`;
      }
    }
    result = result.slice(0, start) + expression + result.slice(end + 1);
    if (result.length > MAX_EXPRESSION_LENGTH) throw new Error("Expression is too long.");
  }
  if (result.includes("}")) throw new Error("Check the piecewise braces.");
  return result;
}
