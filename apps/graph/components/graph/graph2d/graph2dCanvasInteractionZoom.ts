import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import type { Viewport2D } from "@/types/graphUi";
import { clamp } from "./graph2dCanvasMath";
import { graph2dScreenToMath } from "./graph2dCanvasTransforms";
import { WHEEL_PINCH_ZOOM_MAX_STEP, WHEEL_PINCH_ZOOM_SENSITIVITY } from "./graph2dCanvasConstants";

/** Returns viewport fields after zooming toward a fixed screen-space anchor. */
export function graph2dViewportPatchZoomAtScreen(
  mouseX: number,
  mouseY: number,
  factor: number,
  width: number,
  height: number,
  viewport: Viewport2D
): Pick<Viewport2D, "scale" | "centerX" | "centerY"> {
  const mathPos = graph2dScreenToMath(mouseX, mouseY, width, height, viewport);
  const newScale = clamp(viewport.scale * factor, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
  const newCenterX = mathPos.horizontal - (mouseX - width / 2) / newScale;
  const newCenterY = mathPos.vertical + (mouseY - height / 2) / newScale;
  return {
    scale: newScale,
    centerX: newCenterX,
    centerY: newCenterY
  };
}

export interface Graph2dWheelGesture {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  clientX: number;
  clientY: number;
}

// S26 infinite-paper gestures (Excalidraw model), pure and unit-tested:
// plain wheel/trackpad scroll pans both axes at any zoom; Ctrl/Cmd+wheel
// (trackpad pinch) zooms toward the cursor with a delta-proportional
// factor. Line/page deltaModes normalize to pixels. Non-finite inputs
// return null (no viewport commit).
export function graph2dWheelViewportPatch(
  gesture: Graph2dWheelGesture,
  rectWidth: number,
  rectHeight: number,
  viewport: Viewport2D
): Pick<Viewport2D, "scale" | "centerX" | "centerY"> | null {
  const { deltaX, deltaY, deltaMode, ctrlKey, metaKey, clientX, clientY } = gesture;
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    !Number.isFinite(rectWidth) ||
    !Number.isFinite(rectHeight) ||
    rectWidth <= 0 ||
    rectHeight <= 0 ||
    !Number.isFinite(viewport.centerX) ||
    !Number.isFinite(viewport.centerY) ||
    !Number.isFinite(viewport.scale) ||
    viewport.scale <= 0
  ) {
    return null;
  }
  if (ctrlKey || metaKey) {
    const smooth = Math.exp(-deltaY * WHEEL_PINCH_ZOOM_SENSITIVITY);
    const factor = Math.min(WHEEL_PINCH_ZOOM_MAX_STEP, Math.max(1 / WHEEL_PINCH_ZOOM_MAX_STEP, smooth));
    return graph2dViewportPatchZoomAtScreen(clientX, clientY, factor, rectWidth, rectHeight, viewport);
  }
  const deltaModeScale = deltaMode === 1 ? 16 : deltaMode === 2 ? rectHeight : 1;
  return {
    scale: viewport.scale,
    centerX: viewport.centerX + (deltaX * deltaModeScale) / viewport.scale,
    centerY: viewport.centerY - (deltaY * deltaModeScale) / viewport.scale
  };
}
