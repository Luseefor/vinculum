"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
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
}

function Pane({
  children,
  showEmptyPrompt = false,
  workspaceId
}: {
  children: ReactNode;
  /** S30: the empty-scene prompt renders once per layout (first pane). */
  showEmptyPrompt?: boolean;
  workspaceId?: WorkspaceId;
}) {
  return (
    <section className="relative h-full w-full min-w-0 overflow-hidden bg-[var(--surface-canvas)]">
      {children}
      {showEmptyPrompt && workspaceId ? <CanvasEmptyState workspaceId={workspaceId} /> : null}
    </section>
  );
}

export default function ViewportHost({
  mode,
  viewport2d,
  viewport2dQuadTop,
  viewport3d,
  workspaceId
}: ViewportHostProps) {
  const mountViewport = (node: ReactNode, key: string): ReactNode => {
    if (isValidElement(node)) return cloneElement(node, { key });
    return node;
  };

  if (mode === "2d") {
    return (
      <Pane showEmptyPrompt workspaceId={workspaceId}>
        {mountViewport(viewport2d, "single-2d")}
      </Pane>
    );
  }

  if (mode === "3d") {
    return (
      <Pane showEmptyPrompt workspaceId={workspaceId}>
        {mountViewport(viewport3d, "single-3d")}
      </Pane>
    );
  }

  if (mode === "split") {
    return (
      <SplitViewport
        primary={
          <Pane showEmptyPrompt workspaceId={workspaceId}>
            {mountViewport(viewport2d, "split-2d")}
          </Pane>
        }
        secondary={
          <Pane>
            {mountViewport(viewport3d, "split-3d")}
          </Pane>
        }
      />
    );
  }

  const quadTop2d = viewport2dQuadTop ?? viewport2d;

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-[var(--border-strong)]">
      <Pane showEmptyPrompt workspaceId={workspaceId}>
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
