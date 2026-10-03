// S34 responsive composition model — the single source of truth for
// breakpoint behavior (PART 1/2/139).
//
// Three regimes (content-characterized, not device-named):
// - compact: phone/narrow — canvas first, NO persistent side panels; Objects
//   and Inspector are sheets, at most one primary sheet at a time.
// - medium: tablet/narrow-laptop — canvas dominant, ONE persistent rail
//   (Objects) + Inspector drawer; three simultaneous columns forbidden.
// - wide: desktop — S30–S33 Objects | Canvas | Inspector architecture intact.
//
// Thresholds (shell CSS pixels):
// - compact: width < 720
// - medium: 720 ≤ width < 1100
// - wide: width ≥ 1100 (existing inspectorDrawer ≤1100 boundary preserved,
//   so S30–S33 wide behavior is byte-identical).
//
// No component may branch on raw window.innerWidth; behavior reads
// editorStore.responsiveComposition (set once per resize in EditorShell).
// Purely stylistic tweaks may use CSS, but behavioral forks use this.

export type ResponsiveComposition = "compact" | "medium" | "wide";

export const COMPACT_MAX_WIDTH = 720;
export const WIDE_MIN_WIDTH = 1100;
/** Short viewports (landscape phones) use compact sheets/drawers too. */
export const COMPACT_MAX_HEIGHT = 500;

export function compositionForWidth(width: number): ResponsiveComposition {
  return compositionForViewport(width, Number.POSITIVE_INFINITY);
}

/**
 * Compact when narrow OR short (S34 PART 11/69: 844×390 landscape is not a
 * shrunken tablet — side drawers and compact chrome apply). Medium covers
 * tablets and narrow laptops; wide preserves S30–S33 exactly.
 */
export function compositionForViewport(width: number, height: number): ResponsiveComposition {
  if (!Number.isFinite(width) || width < 0) {
    return "wide";
  }
  if (width < COMPACT_MAX_WIDTH) {
    return "compact";
  }
  if (Number.isFinite(height) && height < COMPACT_MAX_HEIGHT) {
    return "compact";
  }
  if (width < WIDE_MIN_WIDTH) {
    return "medium";
  }
  return "wide";
}
