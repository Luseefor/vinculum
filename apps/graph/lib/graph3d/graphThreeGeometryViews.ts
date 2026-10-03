import type { GeometryLayout, GeometryView } from "@/lib/types/ui";

/**
 * Pure Geometry Studio view model: pane composition, pane rectangles,
 * pointer routing, and orthographic camera orientation data.
 *
 * Renderer-independent except for documented conventions:
 * - Rectangles use CSS pixels with a top-left origin (DPR-independent;
 *   three.js multiplies viewport/scissor internally, pointer NDC derives
 *   from the same CSS coordinates).
 * - Camera orientation entries are consumed by the Three.js layer, which
 *   must reproduce the pane mapping below without mirrored axes.
 */

export interface PaneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OrthoCameraOrientation {
  /** Unit-ish direction from the target to the camera position (world axes). */
  positionDirection: readonly [number, number, number];
  /** Camera up vector (world axes). */
  up: readonly [number, number, number];
}

/**
 * Orthographic camera orientations in WORLD coordinates
 * (world.x = math x, world.y = math z, world.z = math y).
 *
 * Derived so each pane shows +horizontal right and +vertical up:
 * - xy: right = math +x, up = math +y
 * - xz: right = math +x, up = math +z
 * - yz: right = math +y, up = math +z
 */
export const ORTHO_CAMERA_ORIENTATION: Record<Exclude<GeometryView, "perspective">, OrthoCameraOrientation> = {
  xy: { positionDirection: [0, -1, 0], up: [0, 0, 1] },
  xz: { positionDirection: [0, 0, 1], up: [0, 1, 0] },
  yz: { positionDirection: [-1, 0, 0], up: [0, 1, 0] }
};

export const GEOMETRY_VIEW_LABELS: Record<GeometryView, string> = {
  perspective: "Perspective",
  xy: "XY",
  xz: "XZ",
  yz: "YZ"
};

export const QUAD_PANES: readonly GeometryView[] = ["perspective", "xy", "xz", "yz"];

/**
 * Resolve the visible pane list for a layout. Split is always
 * Perspective plus the selected orthographic plane; a perspective
 * secondary falls back to XY so panes never duplicate.
 */
export function resolveGeometryPanes(
  layout: GeometryLayout,
  primary: GeometryView,
  secondary: GeometryView
): GeometryView[] {
  if (layout === "quad") {
    return [...QUAD_PANES];
  }
  if (layout === "split") {
    return ["perspective", secondary === "perspective" ? "xy" : secondary];
  }
  return [primary];
}

/**
 * Pane rectangles in CSS pixels (top-left origin). Single fills the area;
 * split divides horizontally; quad divides into a 2x2 grid
 * (perspective top-left, xy top-right, xz bottom-left, yz bottom-right).
 * Fractional pixels are floored toward the top/left pane; the right/bottom
 * pane absorbs the remainder so panes tile exactly. Any length outside
 * single/split/quad is a caller bug: fall back to a single full-area rect
 * (safe) instead of tiling a mismatched grid. Production validates lengths
 * in setGeometryMultiViewPanes before reaching here.
 */
export function computePaneRects(panes: readonly GeometryView[], width: number, height: number): PaneRect[] {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  if (panes.length <= 1 || panes.length === 3 || panes.length > 4) {
    return [{ left: 0, top: 0, width: safeWidth, height: safeHeight }];
  }
  if (panes.length === 2) {
    const leftWidth = Math.floor(safeWidth / 2);
    return [
      { left: 0, top: 0, width: leftWidth, height: safeHeight },
      { left: leftWidth, top: 0, width: safeWidth - leftWidth, height: safeHeight }
    ];
  }
  const leftWidth = Math.floor(safeWidth / 2);
  const topHeight = Math.floor(safeHeight / 2);
  return [
    { left: 0, top: 0, width: leftWidth, height: topHeight },
    { left: leftWidth, top: 0, width: safeWidth - leftWidth, height: topHeight },
    { left: 0, top: topHeight, width: leftWidth, height: safeHeight - topHeight },
    { left: leftWidth, top: topHeight, width: safeWidth - leftWidth, height: safeHeight - topHeight }
  ];
}

/**
 * Route a CSS-pixel pointer to a pane index. Divider lines belong to the
 * right/bottom pane deterministically; out-of-area pointers clamp to the
 * nearest pane so there are no dead clicks.
 */
export function routePointerToPaneIndex(rects: readonly PaneRect[], x: number, y: number): number {
  if (rects.length === 0) {
    return -1;
  }
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const insideX = x >= rect.left && x < rect.left + rect.width;
    const insideY = y >= rect.top && y < rect.top + rect.height;
    if (insideX && insideY) {
      return index;
    }
    const clampedX = Math.min(Math.max(x, rect.left), rect.left + rect.width);
    const clampedY = Math.min(Math.max(y, rect.top), rect.top + rect.height);
    const distance = (x - clampedX) * (x - clampedX) + (y - clampedY) * (y - clampedY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * Pane-local normalized device coordinates with three.js Y-flip convention.
 */
export function paneLocalNDC(rect: PaneRect, x: number, y: number): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((x - rect.left) / rect.width) * 2 - 1,
    y: -((y - rect.top) / rect.height) * 2 + 1
  };
}

/**
 * Contract mapping from mathematical coordinates to 2D pane coordinates.
 * Orthographic cameras must reproduce these signs exactly (no mirroring).
 */
export function projectMathPointToPane(
  view: GeometryView,
  point: { x: number; y: number; z: number }
): { h: number; v: number } | null {
  if (view === "xy") {
    return { h: point.x, v: point.y };
  }
  if (view === "xz") {
    return { h: point.x, v: point.z };
  }
  if (view === "yz") {
    return { h: point.y, v: point.z };
  }
  return null;
}
