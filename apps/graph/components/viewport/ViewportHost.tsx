"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
import SplitViewport from "@/components/viewport/SplitViewport";
import type { ViewportMode } from "@/lib/types/ui";
import { cn } from "@/components/ui/styles";

interface ViewportHostProps {
  mode: ViewportMode;
  viewport2d: ReactNode;
  /** Quad layout only: second 2D panel (XZ top view, independent camera). */
  viewport2dQuadTop?: ReactNode;
  viewport3d: ReactNode;
  selectedLabel: string;
  snapLabel: string;
}

function Pane({ selectedLabel, snapLabel, children }: { selectedLabel: string; snapLabel: string; children: ReactNode }) {
  return (
    <section className="relative h-full w-full min-w-0 overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
      {/* Bottom-left: scene selection + snap (keeps bottom-right free for zoom/reset controls). */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[12] flex max-w-[min(320px,calc(100%-4rem))] flex-col justify-end">
        <div className="mr-auto flex min-w-0 flex-col gap-0.5 rounded-md border border-[var(--border-subtle)]/75 bg-[var(--surface-overlay)]/85 px-2.5 py-1.5 text-[10px] leading-snug text-[var(--text-secondary)] shadow-sm backdrop-blur-sm">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Scene</div>
          <div className="flex w-full items-baseline gap-1.5 overflow-hidden">
            <span className="shrink-0 text-[var(--text-tertiary)]">Selected</span>
            <span className="truncate font-medium">{selectedLabel}</span>
          </div>
          <div className="flex w-full items-baseline gap-1.5 overflow-hidden">
            <span className="shrink-0 text-[var(--text-tertiary)]">Snap</span>
            <span className="truncate font-medium">{snapLabel}</span>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}

export default function ViewportHost({
  mode,
  viewport2d,
  viewport2dQuadTop,
  viewport3d,
  selectedLabel,
  snapLabel
}: ViewportHostProps) {
  const mountViewport = (node: ReactNode, key: string): ReactNode => {
    if (isValidElement(node)) return cloneElement(node, { key });
    return node;
  };

  if (mode === "2d") {
    return (
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport2d, "single-2d")}
      </Pane>
    );
  }

  if (mode === "3d") {
    return (
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "single-3d")}
      </Pane>
    );
  }

  if (mode === "split") {
    return (
      <SplitViewport
        primary={
          <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
            {mountViewport(viewport2d, "split-2d")}
          </Pane>
        }
        secondary={
          <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
            {mountViewport(viewport3d, "split-3d")}
          </Pane>
        }
      />
    );
  }

  const quadTop2d = viewport2dQuadTop ?? viewport2d;

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-strong)]">
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport2d, "quad-xy")}
      </Pane>
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "quad-perspective")}
      </Pane>
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "quad-front")}
      </Pane>
      <Pane selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(quadTop2d, "quad-top")}
      </Pane>
    </div>
  );
}
