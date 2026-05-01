import { formatCoord, formatProbeCoord } from "./graph2dCanvasFormat";
import type { Canvas2DTool } from "@/types/graphUi";

export function formatGraph2dCoordForTool(n: number, canvas2dTool: Canvas2DTool): string {
  return (canvas2dTool === "probe" ? formatProbeCoord : formatCoord)(n);
}
