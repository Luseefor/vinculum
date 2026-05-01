import type { Axis2DPair } from "@/types/graphUi";

export function format2dGraphPlaneLabel(pair: Axis2DPair): string {
  return pair.toUpperCase();
}

export function format3dBasePlaneLabel(pair: "xy" | "xz" | "yz"): string {
  if (pair === "xy") return "Base XY";
  if (pair === "xz") return "Base XZ";
  return "Base YZ";
}
