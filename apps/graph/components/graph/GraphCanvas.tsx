"use client";

import { useEffect, useRef } from "react";
import { createGraphThreeEngine } from "@/lib/graph3d/GraphThreeEngine";
import { useGraphStore } from "@/store/graphStore";
import { format3dBasePlaneLabel } from "@/components/viewport/viewportLabelFormat";
import { cn } from "@/components/ui/styles";

export default function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const baseline3dPlane = useGraphStore((state) => state.ui.baseline3dPlane);
  const cursorClass =
    canvas3dTool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : canvas3dTool === "draw"
        ? "cursor-cell"
        : "cursor-crosshair";
  const toolLabel =
    canvas3dTool === "measureDistance"
      ? "Distance"
      : canvas3dTool === "measureAngle"
        ? "Angle"
        : canvas3dTool === "addPin"
          ? "Pin"
          : canvas3dTool === "draw"
            ? "Sketch"
            : canvas3dTool === "probe"
              ? "Probe"
              : "Pan";

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const engine = createGraphThreeEngine(element);
    return () => {
      engine.dispose();
    };
  }, []);

  const basePlane = format3dBasePlaneLabel(baseline3dPlane);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${cursorClass}`}>
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-3 z-[25] flex max-w-[min(300px,calc(100%-4rem))] min-w-0 flex-col gap-1"
        )}
      >
        <div className="rounded-[5px] border border-[var(--border-subtle)]/80 bg-[var(--surface-overlay)]/88 px-2 py-1 shadow-sm backdrop-blur-sm">
          <div className="min-w-0 truncate text-[11px] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
            3D Scene
            <span className="font-normal text-[var(--text-tertiary)]"> · </span>
            <span className="font-medium text-[var(--text-secondary)]">{basePlane}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            <span className="rounded bg-[var(--surface-muted)]/80 px-1.5 py-0.5 text-[var(--accent)]">{toolLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
