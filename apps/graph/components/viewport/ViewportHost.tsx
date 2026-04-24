"use client";

import type { ReactNode } from "react";
import SplitViewport from "@/components/viewport/SplitViewport";
import SelectionOverlay from "@/components/viewport/SelectionOverlay";
import type { ViewportMode } from "@/lib/types/ui";

interface ViewportHostProps {
  mode: ViewportMode;
  viewport2d: ReactNode;
  viewport3d: ReactNode;
}

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative h-full w-full min-w-0">
      <SelectionOverlay label={title} />
      {children}
    </section>
  );
}

export default function ViewportHost({ mode, viewport2d, viewport3d }: ViewportHostProps) {
  if (mode === "2d") {
    return <Pane title="2D Graph">{viewport2d}</Pane>;
  }

  if (mode === "3d") {
    return <Pane title="3D Perspective">{viewport3d}</Pane>;
  }

  if (mode === "split") {
    return (
      <SplitViewport
        primary={<Pane title="2D Graph">{viewport2d}</Pane>}
        secondary={<Pane title="3D Perspective">{viewport3d}</Pane>}
      />
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-subtle)]">
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane title="2D Graph (XY)">{viewport2d}</Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane title="3D Perspective">{viewport3d}</Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane title="Front (placeholder)">
          <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">Front view coming soon</div>
        </Pane>
      </div>
      <div className="min-h-0 bg-[var(--surface-canvas)]">
        <Pane title="Top (placeholder)">
          <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">Top view coming soon</div>
        </Pane>
      </div>
    </div>
  );
}
