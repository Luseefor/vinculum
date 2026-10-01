"use client";

import { useEffect, useRef, useState } from "react";
import { createGraphThreeEngine } from "@/lib/graph3d/GraphThreeEngine";
import { subscribeCanvasFrameRequests } from "@/lib/interaction/canvasFrameRequests";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { format3dBasePlaneLabel } from "@/components/viewport/viewportLabelFormat";
import { cn } from "@/components/ui/styles";

export default function GraphCanvas({ suspended = false }: { suspended?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createGraphThreeEngine> | null>(null);
  const [renderReady, setRenderReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const baseline3dPlane = useGraphStore((state) => state.ui.baseline3dPlane);
  const multiPane = useEditorStore((state) => state.viewportMode === "split" || state.viewportMode === "quad");
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

    let active = true;
    const engine = createGraphThreeEngine(element, (message) => { if (active) setRenderError(message); });
    engineRef.current = engine;
    engine.ready.then(() => { if (active) setRenderReady(true); }).catch(() => {
      if (active) setRenderError("The 3D renderer could not start. Check GPU access in your browser, then retry the viewport.");
    });
    // S33 Frame Selected / Fit Scene in the legacy perspective view
    // (Math Lab 3D); orthographic drag handles live in Geometry panes.
    const unsubscribeFrame = subscribeCanvasFrameRequests((kind) => {
      if (kind === "selected") {
        engine.frameSelectedObject();
      } else {
        engine.fitSceneToView();
      }
    });
    return () => {
      active = false;
      unsubscribeFrame();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setSuspended(suspended);
  }, [suspended]);

  const basePlane = format3dBasePlaneLabel(baseline3dPlane);
  const showTool = canvas3dTool !== "pan";
  const showIdentity = multiPane || showTool;
  if (renderError) throw new Error(renderError);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${cursorClass}`} style={{ touchAction: "none" }}>
      {!renderReady ? <p role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--surface-canvas)] text-sm text-[var(--text-secondary)]">Starting 3D renderer…</p> : null}
      {showIdentity ? (
        <div
          className={cn(
            "pointer-events-none absolute left-3 top-3 z-[25] flex max-w-[min(300px,calc(100%-4rem))] min-w-0 flex-col gap-1"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-overlay)] py-1 shadow-[var(--shadow-control)]",
              multiPane ? "pl-3" : "pl-1",
              showTool ? "pr-1" : "pr-3"
            )}
          >
            {multiPane ? (
              <div className="min-w-0 truncate text-[12px] font-medium leading-tight text-[var(--text-primary)]">
                3D Scene
                <span className="font-normal text-[var(--text-tertiary)]"> · </span>
                <span className="text-[var(--text-secondary)]">{basePlane}</span>
              </div>
            ) : null}
            {showTool ? (
              <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-ink)]">{toolLabel}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
