import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import type { Viewport2D } from "@/types/graphUi";
import { clamp } from "./graph2dCanvasMath";
import { graph2dScreenToMath } from "./graph2dCanvasTransforms";

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
