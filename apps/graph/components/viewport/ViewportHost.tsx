"use client";

import type { ReactNode } from "react";
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
  if (mode === "2d") {
    return (
      <Pane
        title="2D Graph"
        toolLabel={primaryToolLabel}
        zoomLabel={zoomLabel}
        selectedLabel={selectedLabel}
        snapLabel={snapLabel}
      >
        {viewport2d}
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
        {viewport3d}
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
            {viewport2d}
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
            {viewport3d}
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
          {viewport2d}
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
          {viewport3d}
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="Front (placeholder)"
          toolLabel={secondaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">Front view coming soon</div>
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane
          title="Top (placeholder)"
          toolLabel={secondaryToolLabel}
          zoomLabel={zoomLabel}
          selectedLabel={selectedLabel}
          snapLabel={snapLabel}
        >
          <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">Top view coming soon</div>
        </Pane>
      </div>
    </div>
  );
}
