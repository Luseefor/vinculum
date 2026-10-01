"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createGraphThreeEngine } from "@/lib/graph3d/GraphThreeEngine";
import type { GraphThreeEngine } from "@/lib/graph3d/graphThreeEngineTypes";
import { subscribeCanvasFrameRequests } from "@/lib/interaction/canvasFrameRequests";
import { GEOMETRY_VIEW_LABELS, computePaneRects, resolveGeometryPanes } from "@/lib/graph3d/graphThreeGeometryViews";
import { routePointerToPaneIndex } from "@/lib/graph3d/graphThreeGeometryViews";
import type { GeometryView } from "@/lib/types/ui";
import { useEditorStore } from "@/lib/store/editorStore";
import { cn } from "@/components/ui/styles";
import CanvasEmptyState from "@/components/viewport/CanvasEmptyState";

function paneFraction(index: number, paneCount: number): { left: string; top: string } {
  if (paneCount <= 1) {
    return { left: "0.75rem", top: "0.75rem" };
  }
  if (paneCount === 2) {
    return index === 0
      ? { left: "0.75rem", top: "0.75rem" }
      : { left: "calc(50% + 0.75rem)", top: "0.75rem" };
  }
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    left: column === 0 ? "0.75rem" : "calc(50% + 0.75rem)",
    top: row === 0 ? "0.75rem" : "calc(50% + 0.75rem)"
  };
}

/**
 * Geometry Studio viewport: one shared Three.js scene rendered through
 * perspective + orthographic cameras with scissor viewports. Mounts exactly
 * one engine (one GPU context, one sync path) regardless of pane count.
 */
export default function GeometryViewport({
  className = "",
  suspended = false
}: {
  className?: string;
  suspended?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphThreeEngine | null>(null);
  const [renderReady, setRenderReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const geometryLayout = useEditorStore((state) => state.geometryLayout);
  const geometryView = useEditorStore((state) => state.geometryView);
  const geometrySplitView = useEditorStore((state) => state.geometrySplitView);

  const panes = useMemo(
    () => resolveGeometryPanes(geometryLayout, geometryView, geometrySplitView),
    [geometryLayout, geometryView, geometrySplitView]
  );
  const [activeView, setActiveView] = useState<GeometryView>(panes[0] ?? "perspective");

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
    // S33 Frame Selected / Fit Scene (camera-only): the active pane frames.
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

  useEffect(() => {
    engineRef.current?.setGeometryPanes(panes);
    const first = panes[0] ?? "perspective";
    setActiveView((current) => (panes.includes(current) ? current : first));
  }, [panes]);

  const activatePane = (view: GeometryView) => {
    engineRef.current?.setActiveGeometryView(view);
    setActiveView(view);
  };

  const handleContainerPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || panes.length <= 1) {
      return;
    }
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    // Same helper the renderer uses, so chip highlight always agrees with
    // the pane that receives the pointer.
    const paneRects = computePaneRects(panes, rect.width, rect.height);
    const index = routePointerToPaneIndex(paneRects, event.clientX - rect.left, event.clientY - rect.top);
    const view = panes[index];
    if (view) {
      setActiveView(view);
    }
  };

  const handleContainerWheelCapture = (event: ReactWheelEvent<HTMLDivElement>) => {
    // S16-R3: wheel routing also activates (engine zooms the routed pane),
    // so the chip highlight cannot go stale when scrolling over an inactive
    // pane. Read-only: zooming itself stays engine-owned.
    const container = containerRef.current;
    if (!container || panes.length <= 1) {
      return;
    }
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const paneRects = computePaneRects(panes, rect.width, rect.height);
    const index = routePointerToPaneIndex(paneRects, event.clientX - rect.left, event.clientY - rect.top);
    const view = panes[index];
    if (view) {
      setActiveView(view);
    }
  };

  if (renderError) throw new Error(renderError);
  return (
    <div className={`h-full w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDownCapture={handleContainerPointerDownCapture}
        onWheelCapture={handleContainerWheelCapture}
      >
        {!renderReady ? <p role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--surface-canvas)] text-sm text-[var(--text-secondary)]">Starting 3D renderer…</p> : null}
        {/* S30: single empty-scene prompt (the engine canvas mounts once). */}
        <CanvasEmptyState workspaceId="geometry" />
        {/* Pane buttons pick the active pane; a single pane needs no picker
            (the toolbar View select already names it). */}
        {panes.length > 1 && panes.map((pane, index) => {
          const position = paneFraction(index, panes.length);
          return (
            <button
              key={pane}
              type="button"
              aria-label={`${GEOMETRY_VIEW_LABELS[pane]} viewport`}
              aria-pressed={activeView === pane}
              title={`${GEOMETRY_VIEW_LABELS[pane]} viewport`}
              onClick={() => activatePane(pane)}
              style={{ position: "absolute", left: position.left, top: position.top }}
              className={cn(
                "z-20 h-7 shrink-0 rounded-full border px-3 text-[12px] font-medium shadow-[var(--shadow-control)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                activeView === pane
                  ? "border-[var(--accent)] bg-[var(--surface-overlay)] text-[var(--accent-ink)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {GEOMETRY_VIEW_LABELS[pane]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
