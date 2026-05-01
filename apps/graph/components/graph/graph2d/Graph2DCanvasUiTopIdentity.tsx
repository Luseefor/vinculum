"use client";

import type { Axis2DPair, Canvas2DTool } from "@/types/graphUi";
import { format2dGraphPlaneLabel } from "@/components/viewport/viewportLabelFormat";
import { cn } from "@/components/ui/styles";

function toolShortLabel(tool: Canvas2DTool): string {
  if (tool === "measureDistance") return "Distance";
  if (tool === "measureAngle") return "Angle";
  if (tool === "addPin") return "Pin";
  if (tool === "draw") return "Sketch";
  if (tool === "probe") return "Probe";
  return "Pan";
}

export type Graph2DCanvasUiTopIdentityProps = {
  pairForCanvas: Axis2DPair;
  canvas2dTool: Canvas2DTool;
};

export function Graph2DCanvasUiTopIdentity({ pairForCanvas, canvas2dTool }: Graph2DCanvasUiTopIdentityProps) {
  const plane = format2dGraphPlaneLabel(pairForCanvas);
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-[25] flex max-w-[min(280px,calc(100%-4rem))] min-w-0 flex-col gap-1"
      )}
    >
      <div className="rounded-[5px] border border-[var(--border-subtle)]/80 bg-[var(--surface-overlay)]/88 px-2 py-1 shadow-sm backdrop-blur-sm">
        <div className="min-w-0 truncate text-[11px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
          2D Graph
          <span className="font-normal text-[var(--text-tertiary)]"> · </span>
          <span className="font-medium text-[var(--text-secondary)]">{plane}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          <span className="rounded bg-[var(--surface-muted)]/80 px-1.5 py-0.5 text-[var(--accent)]">
            {toolShortLabel(canvas2dTool)}
          </span>
        </div>
      </div>
    </div>
  );
}
