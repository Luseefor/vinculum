import { getGridSettings, snapToGrid } from "@/lib/graph/grid";

export interface AdaptiveGridState {
  majorStep: number;
  minorStep: number;
  fadeDistance: number;
  gridOffset: [number, number];
}

export function createAdaptiveGridState(
  cameraX: number,
  cameraY: number,
  cameraZ: number
): AdaptiveGridState {
  const cameraDistance = Math.hypot(cameraX, cameraY, cameraZ);
  const settings = getGridSettings(cameraDistance);

  const gridOffset: [number, number] = [
    snapToGrid(cameraX, settings.majorStep),
    snapToGrid(cameraZ, settings.majorStep)
  ];

  return {
    majorStep: settings.majorStep,
    minorStep: settings.minorStep,
    fadeDistance: settings.fadeDistance,
    gridOffset
  };
}

export function hasAdaptiveGridStateChanged(a: AdaptiveGridState, b: AdaptiveGridState): boolean {
  return (
    a.majorStep !== b.majorStep ||
    a.minorStep !== b.minorStep ||
    Math.abs(a.fadeDistance - b.fadeDistance) > 0.001 ||
    a.gridOffset[0] !== b.gridOffset[0] ||
    a.gridOffset[1] !== b.gridOffset[1]
  );
}
