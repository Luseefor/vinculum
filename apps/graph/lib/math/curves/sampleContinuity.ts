/** A jump or pole retains its size as its interval shrinks; a smooth steep slope does not.
 * At most ten approved evaluator calls, independent of scene resolution and zoom.
 */
export function isContinuousSampleEdge(evaluate: (t: number) => number | null, left: number, right: number, a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tolerance = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  let initialJump = Math.abs(b - a);
  for (let iteration = 0; iteration < 10; iteration++) {
    const middle = (left + right) / 2;
    const value = evaluate(middle);
    if (value === null || !Number.isFinite(value)) return false;
    const before = Math.abs(value - a), after = Math.abs(b - value);
    if (iteration === 0) initialJump = Math.max(initialJump, before, after);
    if (Math.max(before, after) <= Math.max(tolerance, initialJump / 32)) return true;
    if (iteration === 0 && Math.abs(value - (a + b) / 2) <= tolerance) return true;
    if (before >= after) { right = middle; b = value; }
    else { left = middle; a = value; }
  }
  return false;
}
