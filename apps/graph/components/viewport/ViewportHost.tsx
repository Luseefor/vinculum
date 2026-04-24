"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
import SplitViewport from "@/components/viewport/SplitViewport";
import type { ViewportMode } from "@/lib/types/ui";

interface ViewportHostProps {
  mode: ViewportMode;
  viewport2d: ReactNode;
  viewport3d: ReactNode;
  selectedLabel: string;
  primaryToolLabel: string;
  secondaryToolLabel: string;
  zoomLabel: string;
  snapLabel: string;
}

function Pane({
  title,
  toolLabel,
  zoomLabel,
  selectedLabel,
  snapLabel,
  children
}: {
  title: string;
  toolLabel: string;
  zoomLabel: string;
  selectedLabel: string;
  snapLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="relative h-full w-full min-w-0">
      <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/90 px-2 py-1 text-[10px] text-[var(--text-secondary)]">
        {title} · {toolLabel} · {zoomLabel}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/90 px-2 py-1 text-[10px] text-[var(--text-secondary)]">
        Selected: {selectedLabel} · Snap: {snapLabel}
      </div>
      {children}
    </section>
  );
}

export default function ViewportHost({
  mode,
  viewport2d,
  viewport3d,
  selectedLabel,
  primaryToolLabel,
  secondaryToolLabel,
  zoomLabel,
  snapLabel
}: ViewportHostProps) {
  const mountViewport = (node: ReactNode, key: string): ReactNode => {
    if (isValidElement(node)) {
      return cloneElement(node, { key });
    }
    return node;
  };

  if (mode === "2d") {
    return (
      <Pane
        title="2D Graph"
        toolLabel={primaryToolLabel}
        zoomLabel={zoomLabel}
        selectedLabel={selectedLabel}
        snapLabel={snapLabel}
      >
        {mountViewport(viewport2d, "single-2d")}
      </Pane>
    );
  }

  if (mode === "3d") {
    return (
      <Pane
        title="3D Perspective"
        toolLabel={secondaryToolLabel}
        zoomLabel={zoomLabel}
        selectedLabel={selectedLabel}
        snapLabel={snapLabel}
      >
        {mountViewport(viewport3d, "single-3d")}
      </Pane>
    );
  }

  if (mode === "split") {
    return (
      <SplitViewport
        primary={
          <Pane
            title="2D Graph"
            toolLabel={primaryToolLabel}
            zoomLabel={zoomLabel}
            selectedLabel={selectedLabel}
            snapLabel={snapLabel}
          >
            {mountViewport(viewport2d, "split-2d")}
          </Pane>
        }
        secondary={
          <Pane
            title="3D Perspective"
            toolLabel={secondaryToolLabel}
            zoomLabel={zoomLabel}
            selectedLabel={selectedLabel}
            snapLabel={snapLabel}
          >
            {mountViewport(viewport3d, "split-3d")}
          </Pane>
        }
      />
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-subtle)]">
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="2D Graph (XY)"
          toolLabel={primaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          {mountViewport(viewport2d, "quad-xy")}
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="3D Perspective"
          toolLabel={secondaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          {mountViewport(viewport3d, "quad-perspective")}
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="Front (linked)"
          toolLabel={secondaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          {mountViewport(viewport3d, "quad-front")}
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="Top (linked)"
          toolLabel={secondaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          {mountViewport(viewport2d, "quad-top")}
        </Pane>
      </div>
    </div>
  );
}
