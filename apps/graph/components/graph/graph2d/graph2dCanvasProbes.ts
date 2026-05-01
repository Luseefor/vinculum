import type { GraphProbePin } from "@/types/graphUi";
import type { DrawContext } from "./graph2dCanvasTypes";

export type ViewportTransform = Pick<DrawContext, "width" | "height" | "centerX" | "centerY" | "scale">;

export function projectWorldTo2dPair(
  point: { x: number; y: number; z: number },
  pair: "xy" | "xz" | "yz"
): { horizontal: number; vertical: number } {
  if (pair === "xy") {
    return { horizontal: point.x, vertical: point.y };
  }
  if (pair === "xz") {
    return { horizontal: point.x, vertical: point.z };
  }
  return { horizontal: point.y, vertical: point.z };
}

export function findNearestProbePinScreen(
  pins: GraphProbePin[],
  axisPair: "xy" | "xz" | "yz",
  x: number,
  y: number,
  dc: ViewportTransform,
  mathToScreen: (horizontal: number, vertical: number, dc: ViewportTransform) => { x: number; y: number }
): { id: string } | null {
  let best: { id: string; dist2: number } | null = null;
  const maxDist2 = 12 * 12;
  for (const pin of pins) {
    const math = projectWorldTo2dPair(pin.world, axisPair);
    const s = mathToScreen(math.horizontal, math.vertical, dc);
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= maxDist2 && (!best || d2 < best.dist2)) {
      best = { id: pin.id, dist2: d2 };
    }
  }
  return best ? { id: best.id } : null;
}
