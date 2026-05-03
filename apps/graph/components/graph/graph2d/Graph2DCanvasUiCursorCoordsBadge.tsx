"use client";

import { formatGraph2dCoordForTool } from "./graph2dUiFormatCoordForTool";
import type { AxisPairSpec, MousePosition } from "./graph2dCanvasTypes";
import type { Canvas2DTool } from "@/types/graphUi";

export type Graph2DCanvasUiCursorCoordsBadgeProps = {
  mousePos: MousePosition;
  axisPair: AxisPairSpec;
  canvas2dTool: Canvas2DTool;
  /** When true, render as a row inside a parent HUD card (no outer border/shadow). */
  embedded?: boolean;
};

export function Graph2DCanvasUiCursorCoordsBadge({
  mousePos,
  axisPair,
  canvas2dTool,
  embedded = false
}: Graph2DCanvasUiCursorCoordsBadgeProps) {
  return (
    <div
      className={
        embedded
          ? "min-w-0 truncate font-mono text-[10px] text-[var(--text-primary)]"
          : "max-w-[min(200px,calc(100%-1rem))] truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-lg"
      }
    >
      <span className="text-[var(--text-tertiary)]">Cursor </span>
      {axisPair.horizontalLabel}: {formatGraph2dCoordForTool(mousePos.math.horizontal, canvas2dTool)}
      {" · "}
      {axisPair.verticalLabel}: {formatGraph2dCoordForTool(mousePos.math.vertical, canvas2dTool)}
    </div>
  );
}
