import type { ViewportTransform } from "./graph2dCanvasProbes";

export type Viewport2dState = {
  centerX: number;
  centerY: number;
  scale: number;
};

export function graph2dScreenToMath(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  viewport: Viewport2dState
): { horizontal: number; vertical: number } {
  const horizontal = (screenX - width / 2) / viewport.scale + viewport.centerX;
  const vertical = -(screenY - height / 2) / viewport.scale + viewport.centerY;
  return { horizontal, vertical };
}

export function graph2dMathToScreen(mathX: number, mathY: number, dc: ViewportTransform): { x: number; y: number } {
  const screenX = (mathX - dc.centerX) * dc.scale + dc.width / 2;
  const screenY = -(mathY - dc.centerY) * dc.scale + dc.height / 2;
  return { x: screenX, y: screenY };
}
