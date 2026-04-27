"use client";

import { formatGraph2dCoordForTool } from "./graph2dUiFormatCoordForTool";
import type { AxisPairSpec, MousePosition } from "./graph2dCanvasTypes";
import type { Canvas2DTool } from "@/types/graphUi";

export type Graph2DCanvasUiCursorCoordsBadgeProps = {
  mousePos: MousePosition;
  axisPair: AxisPairSpec;
  canvas2dTool: Canvas2DTool;
};

export function Graph2DCanvasUiCursorCoordsBadge({
  mousePos,
  axisPair,
  canvas2dTool
}: Graph2DCanvasUiCursorCoordsBadgeProps) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-lg">
      <span className="text-[var(--text-tertiary)]">Cursor </span>
      {axisPair.horizontalLabel}: {formatGraph2dCoordForTool(mousePos.math.horizontal, canvas2dTool)}
      {" · "}
      {axisPair.verticalLabel}: {formatGraph2dCoordForTool(mousePos.math.vertical, canvas2dTool)}
    </div>
  );
}
