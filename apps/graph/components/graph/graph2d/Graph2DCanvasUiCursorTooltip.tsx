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

  const x = mousePos.screen.x;
  const y = mousePos.screen.y;
  const cw = containerRef.current?.clientWidth || 0;
  const ch = containerRef.current?.clientHeight || 0;
  const isNearRight = cw > 0 && x > cw - 200;
  const isNearBottom = ch > 0 && y > ch - 60;

  return (
    <div
      className="absolute pointer-events-none rounded-[5px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)] shadow-lg whitespace-nowrap max-w-[250px] overflow-hidden text-ellipsis"
      style={{
        left: isNearRight ? undefined : x + CURSOR_TOOLTIP_OFFSET_PX,
        right: isNearRight ? cw - x + CURSOR_TOOLTIP_OFFSET_PX : undefined,
        top: isNearBottom ? undefined : y + CURSOR_TOOLTIP_OFFSET_PX,
        bottom: isNearBottom ? ch - y + CURSOR_TOOLTIP_OFFSET_PX : undefined,
      }}
    >
      ({axisPair.horizontalLabel}: {formatGraph2dCoordForTool(mousePos.math.horizontal, canvas2dTool)},{" "}
      {axisPair.verticalLabel}: {formatGraph2dCoordForTool(mousePos.math.vertical, canvas2dTool)})
    </div>
  );
}
