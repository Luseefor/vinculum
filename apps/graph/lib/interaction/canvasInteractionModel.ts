// S33 canvas interaction model (UI-only, no math semantics).
//
// Small precedence model reusing the S14/S16/S26 tool/pointer state — this
// module documents it; the engine implements it:
//
//   1. armed analysis pick (differentialAnalysisPickArmedId)
//  2. explicit canvas tools (probe/addPin/measure/draw)
//  3. active direct-manipulation drag (handle-drag, pointer-captured)
//  4. direct-manipulation handle press (ortho panes, literal-backed)
//  5. body selection / clean-click deselect (pan tool, <6px)
//  6. camera gesture (orbit/pan/zoom)
//
// Derived overlays (analysis, streamlines, eigen, projection connectors)
// are never pickable and never start interactions. Hover never mutates
// scene state, selection never mutates mathematics, and cameras never
// change canonical math (PART 69).

export type CanvasInteractionState =
  | "idle"
  | "hovering"
  | "camera-pan"
  | "camera-orbit"
  | "object-drag"
  | "handle-drag"
  | "analysis-pick"
  | "draw-probe-mode";

/** Clean-click threshold shared by selection, analysis pick, and drags. */
export const CANVAS_CLEAN_CLICK_PX = 6;

export function isCleanClick(startX: number, startY: number, endX: number, endY: number): boolean {
  if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) {
    return false;
  }
  return Math.hypot(endX - startX, endY - startY) < CANVAS_CLEAN_CLICK_PX;
}
