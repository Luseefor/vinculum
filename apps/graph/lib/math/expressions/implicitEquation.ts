// Pure single-equality syntax helper shared by S10 validation and the S18
// implicit-surface compiler. Object-semantics-neutral: it only identifies a
// supported single mathematical equality (lhs = rhs). Renderer-independent,
// no mathjs, no store.
//
// Grammar: exactly one standalone `=` with non-empty trimmed sides. Comparison
// operators inside conditional expressions are not equation separators. Rejects chained
// equality (`x = y = z`), comparisons (`x == 1`), and missing sides. Never
// decides whether the equation is a plane, an implicit field, or an
// explicit surface; callers apply their own safety/normalization.
//
// NOTE: this intentionally overlaps with `splitImplicitEquation` in
// lib/graph3d/implicitEquationParse.ts. That helper serves the legacy 2-var
// ribbon-contour path (defaults empty sides to "0", rejects `^[xyz]\s*=`);
// this one serves true-field validation/compilation (strict non-empty
// sides). Keep both; do not "deduplicate" them into one grammar.
export function splitSingleMathEquality(equation: string): { lhs: string; rhs: string } | null {
  let firstSeparator = -1;
  for (let i = 0; i < equation.length; i++) {
    if (equation[i] !== "=" || /[<>=!]/.test(equation[i - 1] ?? " ") || equation[i + 1] === "=") continue;
    if (firstSeparator >= 0) return null;
    firstSeparator = i;
  }
  if (firstSeparator < 0) return null;
  const lhs = equation.slice(0, firstSeparator).trim();
  const rhs = equation.slice(firstSeparator + 1).trim();
  if (!lhs || !rhs) {
    return null;
  }
  return { lhs, rhs };
}
