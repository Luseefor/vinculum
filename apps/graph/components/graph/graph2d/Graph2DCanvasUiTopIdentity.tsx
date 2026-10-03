"use client";

import type { Axis2DPair, Canvas2DTool } from "@/types/graphUi";
import { format2dGraphPlaneLabel } from "@/components/viewport/viewportLabelFormat";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

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
  // Pane names only disambiguate multi-pane layouts (the toolbar already names
  // a single view); the tool pill only appears for non-default modes.
  const multiPane = useEditorStore((state) => state.viewportMode === "split" || state.viewportMode === "quad");
  const hasSlice = useGraphStore(state => state.scene.objects.some(object => object.visible && object.kind === "implicitSurface" && Boolean(object.equation.trim())));
  const sliceAxis = pairForCanvas === "xy" ? "z" : pairForCanvas === "xz" ? "y" : "x";
  const showTool = canvas2dTool !== "pan";
  if (!multiPane && !showTool && !hasSlice) {
    return null;
  }
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-[25] flex max-w-[min(280px,calc(100%-4rem))] min-w-0 flex-col gap-1"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-overlay)] py-1 shadow-[var(--shadow-control)]",
          multiPane || hasSlice ? "pl-3" : "pl-1",
          showTool ? "pr-1" : "pr-3"
        )}
      >
        {multiPane || hasSlice ? (
          <div className="min-w-0 truncate text-[12px] font-medium leading-tight text-[var(--text-primary)]">
            2D Graph
            <span className="font-normal text-[var(--text-tertiary)]"> · </span>
            <span className="text-[var(--text-secondary)]">{plane}</span>
            {hasSlice ? <span data-testid="implicit-slice-label" className="text-[var(--text-secondary)]"> · Surface slice: {sliceAxis} = 0</span> : null}
          </div>
        ) : null}
        {showTool ? (
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-ink)]">
            {toolShortLabel(canvas2dTool)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
