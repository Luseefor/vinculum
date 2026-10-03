"use client";

import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import CanvasEmptyState from "@/components/viewport/CanvasEmptyState";
import SplitViewport from "@/components/viewport/SplitViewport";
import type { ViewportMode } from "@/lib/types/ui";
import type { WorkspaceId } from "@/types/graphUi";
import { cn } from "@/components/ui/styles";

interface ViewportHostProps {
  mode: ViewportMode;
  viewport2d: ReactNode;
  /** Quad layout only: second 2D panel (XZ top view, independent camera). */
  viewport2dQuadTop?: ReactNode;
  viewport3d: ReactNode;
  workspaceId: WorkspaceId;
  onOpenGuide?: () => void;
  onOpenExamples?: () => void;
}

function Pane({
  children,
  showEmptyPrompt = false,
  workspaceId,
  onOpenGuide,
  onOpenExamples
}: {
  children: ReactNode;
  /** S30: the empty-scene prompt renders once per layout (first pane). */
  showEmptyPrompt?: boolean;
  workspaceId?: WorkspaceId;
  onOpenGuide?: () => void;
  onOpenExamples?: () => void;
}) {
  return (
    <section className="relative h-full w-full min-w-0 overflow-hidden bg-[var(--surface-canvas)]">
      {children}
      {showEmptyPrompt && workspaceId ? <CanvasEmptyState workspaceId={workspaceId} onOpenGuide={onOpenGuide} onOpenExamples={onOpenExamples} /> : null}
    </section>
  );
}

export default function ViewportHost({
  mode,
  viewport2d,
  viewport2dQuadTop,
  viewport3d,
  workspaceId,
  onOpenGuide,
  onOpenExamples
}: ViewportHostProps) {
  const [visited3d, setVisited3d] = useState(mode !== "2d");
  useEffect(() => { if (mode !== "2d") setVisited3d(true); }, [mode]);
  const mountViewport = (node: ReactNode, key: string, suspended = false): ReactNode => {
    if (isValidElement<{ suspended?: boolean }>(node)) return cloneElement(node, { key, suspended: suspended || node.props.suspended });
    return node;
  };

  if (mode !== "quad") {
    return (
      <SplitViewport
        mode={mode}
        primary={
          <Pane showEmptyPrompt workspaceId={workspaceId} onOpenGuide={onOpenGuide} onOpenExamples={onOpenExamples}>
            {mountViewport(viewport2d, "math-2d", mode === "3d")}
          </Pane>
        }
        secondary={
          <Pane showEmptyPrompt={mode === "3d"} workspaceId={workspaceId} onOpenGuide={onOpenGuide} onOpenExamples={onOpenExamples}>
            {visited3d || mode !== "2d" ? mountViewport(viewport3d, "math-3d", mode === "2d") : null}
          </Pane>
        }
      />
    );
  }

  const quadTop2d = viewport2dQuadTop ?? viewport2d;

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-strong)]">
      <Pane showEmptyPrompt workspaceId={workspaceId} onOpenGuide={onOpenGuide} onOpenExamples={onOpenExamples}>
        {mountViewport(viewport2d, "quad-xy")}
      </Pane>
      <Pane>
        {mountViewport(viewport3d, "quad-perspective")}
      </Pane>
      <Pane>
        {mountViewport(viewport3d, "quad-front")}
      </Pane>
      <Pane>
        {mountViewport(quadTop2d, "quad-top")}
      </Pane>
    </div>
  );
}
