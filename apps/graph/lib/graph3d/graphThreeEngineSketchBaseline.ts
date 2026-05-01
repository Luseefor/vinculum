/** Constrain a world-space sketch sample to the active baseline plane (math Z / X / Y held at 0). */
export function constrainSketchPointToBaselinePlane(
  snapped: { x: number; y: number; z: number },
  baselinePlaneMode: number
): void {
  if (baselinePlaneMode === 1) {
    snapped.z = 0;
  } else if (baselinePlaneMode === 2) {
    snapped.x = 0;
  } else {
    snapped.y = 0;
  }
}
