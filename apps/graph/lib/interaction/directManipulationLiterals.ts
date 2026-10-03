// S33 direct-manipulation literal policy (UI-only).
//
// Direct manipulation must never silently change mathematical meaning, so a
// drag may only rewrite coordinate fields holding PLAIN numeric literals.
// Strict textual criterion — never the evaluation result:
//
// draggable:  "0" "1" "-2.5" "3e-2" "+.5" "  2  "
// locked:     "a" "a+1" "1+2" "sin(theta)" "pi" "" "0x10" "NaN" "Infinity"
//
// Even constant-foldable text ("1+2") or named constants ("pi") stays
// locked: rewriting them would destroy user-authored mathematics. The
// expression compiler is untouched; this helper only gates drag handles.

const NUMERIC_LITERAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

export function isDirectManipulationNumericLiteral(expression: unknown): boolean {
  if (typeof expression !== "string") {
    return false;
  }
  const trimmed = expression.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return false;
  }
  return NUMERIC_LITERAL_PATTERN.test(trimmed);
}

// Deterministic drag-value formatter: finite, locale-independent,
// parser-safe, no trailing-zero noise, no scientific notation for normal
// scene ranges. Raw dragged literals may normalize formatting (documented:
// acceptable for direct-manipulation-created values).
export function formatDragLiteral(value: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value === 0) {
    return "0";
  }
  const rounded = Math.round(value * 1e6) / 1e6;
  if (!Number.isFinite(rounded)) {
    return null;
  }
  if (rounded === 0) {
    return "0";
  }
  return String(rounded);
}
