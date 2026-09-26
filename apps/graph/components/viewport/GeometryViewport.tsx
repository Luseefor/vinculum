"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createGraphThreeEngine } from "@/lib/graph3d/GraphThreeEngine";
import type { GraphThreeEngine } from "@/lib/graph3d/graphThreeEngineTypes";
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
 * one engine (one WebGL context, one sync path) regardless of pane count.
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
    const engine = createGraphThreeEngine(element);
    engineRef.current = engine;
    return () => {
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

  return (
    <div className={`h-full w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDownCapture={handleContainerPointerDownCapture}
        onWheelCapture={handleContainerWheelCapture}
      >
        {/* S30: single empty-scene prompt (the engine canvas mounts once). */}
        <CanvasEmptyState workspaceId="geometry" />
        {panes.map((pane, index) => {
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
                "z-20 h-7 shrink-0 rounded-[5px] border px-2 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                activeView === pane
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-overlay)]/88 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
