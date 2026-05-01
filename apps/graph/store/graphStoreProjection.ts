import type { Axis2DPair } from "@/types/graphUi";

export function project2dPairToWorld(
  point: { horizontal: number; vertical: number },
  pair: Axis2DPair
): { x: number; y: number; z: number } {
  if (pair === "xy") {
    return { x: point.horizontal, y: point.vertical, z: 0 };
  }
  if (pair === "xz") {
    return { x: point.horizontal, y: 0, z: point.vertical };
  }
  return { x: 0, y: point.horizontal, z: point.vertical };
}
