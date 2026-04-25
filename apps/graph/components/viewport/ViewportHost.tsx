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
  /** Short axis label for the primary 2D panel (e.g. `XY`, `XZ`). */
  primary2dPlaneLabel?: string;
  /** Title for the secondary 2D quad (different orthographic plane). */
  secondary2dPlaneTitle?: string;
  viewport3d: ReactNode;
  selectedLabel: string;
  zoomLabel: string;
  snapLabel: string;
}

function Pane({
  title,
  selectedLabel,
  snapLabel,
  children,
  is2d = false
}: {
  title: string;
  selectedLabel: string;
  snapLabel: string;
  children: ReactNode;
  is2d?: boolean;
}) {
  return (
    <section className="relative h-full w-full min-w-0 overflow-hidden bg-[var(--surface-canvas)]">
      {/* Top Left Floating Label */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] shadow-sm backdrop-blur-sm">
        {title} · PAN · Perspective
      </div>

      {/* Bottom Left Consolidated Status Stack */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
        {is2d && (
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-white/90 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] shadow-sm backdrop-blur-sm">
            X: [-10.00, 10.00] · Y: [-10.00, 10.00]
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-white/90 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] shadow-sm backdrop-blur-sm">
          Selected: {selectedLabel} · Snap: {snapLabel}
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
  primary2dPlaneLabel = "XY",
  secondary2dPlaneTitle = "XZ (top)",
  viewport3d,
  selectedLabel,
  zoomLabel,
  snapLabel
}: ViewportHostProps) {
  const mountViewport = (node: ReactNode, key: string): ReactNode => {
    if (isValidElement(node)) return cloneElement(node, { key });
    return node;
  };

  if (mode === "2d") {
    return (
      <Pane title="2D Graph - Plane (XY)" selectedLabel={selectedLabel} snapLabel={snapLabel} is2d>
        {mountViewport(viewport2d, "single-2d")}
      </Pane>
    );
  }

  if (mode === "3d") {
    return (
      <Pane title="3D View - Perspective" selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "single-3d")}
      </Pane>
    );
  }

  if (mode === "split") {
    return (
      <SplitViewport
        primary={
          <Pane title="2D Graph - Plane (XY)" selectedLabel={selectedLabel} snapLabel={snapLabel} is2d>
            {mountViewport(viewport2d, "split-2d")}
          </Pane>
        }
        secondary={
          <Pane title="3D View - Perspective" selectedLabel={selectedLabel} snapLabel={snapLabel}>
            {mountViewport(viewport3d, "split-3d")}
          </Pane>
        }
      />
    );
  }

  const quadTop2d = viewport2dQuadTop ?? viewport2d;

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-subtle)]">
      <Pane title={`2D · ${primary2dPlaneLabel}`} selectedLabel={selectedLabel} snapLabel={snapLabel} is2d>
        {mountViewport(viewport2d, "quad-xy")}
      </Pane>
      <Pane title="3D · Perspective" selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "quad-perspective")}
      </Pane>
      <Pane title="3D · Front" selectedLabel={selectedLabel} snapLabel={snapLabel}>
        {mountViewport(viewport3d, "quad-front")}
      </Pane>
      <Pane title={`2D · ${secondary2dPlaneTitle}`} selectedLabel={selectedLabel} snapLabel={snapLabel} is2d>
        {mountViewport(quadTop2d, "quad-top")}
      </Pane>
    </div>
  );
}
