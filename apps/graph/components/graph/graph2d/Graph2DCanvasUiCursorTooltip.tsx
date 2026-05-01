"use client";

import { type RefObject, useEffect, useState } from "react";
import type { Canvas2DTool } from "@/types/graphUi";
import {
  CURSOR_TOOLTIP_OFFSET_PX,
  CURSOR_TOOLTIP_WIDTH_PX,
  VIEWPORT_BADGE_HEIGHT_PX
} from "./graph2dCanvasConstants";
import type { AxisPairSpec, MousePosition } from "./graph2dCanvasTypes";
import { formatGraph2dCoordForTool } from "./graph2dUiFormatCoordForTool";

export type Graph2DCanvasUiCursorTooltipProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  mousePos: MousePosition;
  axisPair: AxisPairSpec;
  canvas2dTool: Canvas2DTool;
};

export function Graph2DCanvasUiCursorTooltip({
  containerRef,
  mousePos,
  axisPair,
  canvas2dTool
}: Graph2DCanvasUiCursorTooltipProps) {
  const [, setLayoutTick] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }

    const ro = new ResizeObserver(() => {
      setLayoutTick((n) => n + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div
      className="absolute pointer-events-none rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]"
      style={{
        left: Math.min(
          mousePos.screen.x + CURSOR_TOOLTIP_OFFSET_PX,
          (containerRef.current?.clientWidth || 0) - CURSOR_TOOLTIP_WIDTH_PX
        ),
        top: Math.min(
          mousePos.screen.y + CURSOR_TOOLTIP_OFFSET_PX,
          (containerRef.current?.clientHeight || 0) - VIEWPORT_BADGE_HEIGHT_PX
        )
      }}
    >
      ({axisPair.horizontalLabel}: {formatGraph2dCoordForTool(mousePos.math.horizontal, canvas2dTool)},{" "}
      {axisPair.verticalLabel}: {formatGraph2dCoordForTool(mousePos.math.vertical, canvas2dTool)})
    </div>
  );
}
