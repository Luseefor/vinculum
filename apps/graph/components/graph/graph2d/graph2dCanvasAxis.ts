import type { Axis2DPair } from "@/types/graphUi";
import type { AxisPairSpec } from "./graph2dCanvasTypes";

export function getAxisPairSpec(pair: Axis2DPair): AxisPairSpec {
  if (pair === "yz") {
    return {
      horizontal: "y",
      vertical: "z",
      horizontalLabel: "Y",
      verticalLabel: "Z"
    };
  }

  if (pair === "xz") {
    return {
      horizontal: "x",
      vertical: "z",
      horizontalLabel: "X",
      verticalLabel: "Z"
    };
  }

  return {
    horizontal: "x",
    vertical: "y",
    horizontalLabel: "X",
    verticalLabel: "Y"
  };
}
