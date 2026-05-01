import { snapToStep } from "./graph2dCanvasMath";

export function snapGraph2dMathPoint(
  point: { horizontal: number; vertical: number },
  snapEnabled: boolean,
  snapStep: number
): { horizontal: number; vertical: number } {
  if (!snapEnabled || !Number.isFinite(snapStep) || snapStep <= 0) {
    return point;
  }
  return {
    horizontal: snapToStep(point.horizontal, snapStep),
    vertical: snapToStep(point.vertical, snapStep)
  };
}
