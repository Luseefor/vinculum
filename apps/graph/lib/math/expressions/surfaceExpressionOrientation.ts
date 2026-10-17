const EXPLICIT_AXIS = /^([xyz])\s*=\s*(.+)$/i;
const IMPLICIT_STRIP = /^[a-z](\([a-z,\s]*\))?\s*=\s*/i;

export function getEffectiveSurfaceOrientation(
  expression: string,
  fallbackOrientation: "x" | "y" | "z" = "z"
): { body: string; effectiveOrientation: "x" | "y" | "z" } {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { body: "", effectiveOrientation: fallbackOrientation };
  }

  const explicit = EXPLICIT_AXIS.exec(trimmed);
  if (explicit) {
    const letter = explicit[1].toLowerCase();
    if (letter === "x" || letter === "y" || letter === "z") {
      return {
        body: explicit[2].trim(),
        effectiveOrientation: letter
      };
    }
  }

  return {
    body: trimmed.replace(IMPLICIT_STRIP, "").trim(),
    effectiveOrientation: fallbackOrientation
  };
}
