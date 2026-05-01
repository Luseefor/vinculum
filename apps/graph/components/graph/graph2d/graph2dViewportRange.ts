import type { Viewport2dState } from "./graph2dCanvasTransforms";

export type Viewport2dFrame = { width: number; height: number };

export function computeViewport2dRange(viewportFrame: Viewport2dFrame, viewport: Viewport2dState) {
  const { width, height } = viewportFrame;
  const halfWidthUnits = width / (2 * viewport.scale);
  const halfHeightUnits = height / (2 * viewport.scale);

  return {
    horizontalMin: viewport.centerX - halfWidthUnits,
    horizontalMax: viewport.centerX + halfWidthUnits,
    verticalMin: viewport.centerY - halfHeightUnits,
    verticalMax: viewport.centerY + halfHeightUnits
  };
}

export type Viewport2dVisibleRange = ReturnType<typeof computeViewport2dRange>;
