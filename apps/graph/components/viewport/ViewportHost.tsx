"use client";

import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import CanvasEmptyState from "@/components/viewport/CanvasEmptyState";
import SplitViewport from "@/components/viewport/SplitViewport";
import type { ViewportMode } from "@/lib/types/ui";
import type { WorkspaceId } from "@/types/graphUi";

interface ViewportHostProps {
  mode: ViewportMode;
  viewport2d: ReactNode;
  /** Quad layout only: second 2D panel (XZ top view, independent camera). */
  viewport2dQuadTop?: ReactNode;
  viewport3d: ReactNode;
  /** Quad only: orthographic projection of the shared 3D scene. */
  viewport3dQuadSide?: ReactNode;
  workspaceId: WorkspaceId;
  onOpenGuide?: () => void;
  onOpenExamples?: () => void;
  onStart?: () => void;
  gettingStarted?: ReactNode;
}

function Pane({ children }: { children: ReactNode }) {
  return (
    <section className="relative h-full w-full min-w-0 overflow-hidden bg-(--surface-canvas)">
      {children}
    </section>
  );
}

export default function ViewportHost({
  mode,
  viewport2d,
  viewport2dQuadTop,
  viewport3d,
  viewport3dQuadSide,
  workspaceId,
  onOpenGuide,
  onOpenExamples,
  onStart,
  gettingStarted
}: ViewportHostProps) {
  const [visited3d, setVisited3d] = useState(mode !== "2d");
  const [visitedQuad, setVisitedQuad] = useState(mode === "quad");
  useEffect(() => { if (mode !== "2d") setVisited3d(true); }, [mode]);
  useEffect(() => { if (mode === "quad") setVisitedQuad(true); }, [mode]);
  const mountViewport = (node: ReactNode, key: string, suspended = false): ReactNode => {
    if (isValidElement<{ suspended?: boolean }>(node)) return cloneElement(node, { key, suspended: suspended || node.props.suspended });
    return node;
  };

  return (
    <div className="relative h-full w-full">
      <SplitViewport
        mode={mode}
        primary={
          <Pane>
            {mountViewport(viewport2d, "math-2d", mode === "3d")}
          </Pane>
        }
        secondary={
          <Pane>
            {visited3d || mode !== "2d" ? mountViewport(viewport3d, "math-3d", mode === "2d") : null}
          </Pane>
        }
        lowerLeft={visitedQuad || mode === "quad" ? (
          <Pane>{mountViewport(viewport3dQuadSide, "math-side", mode !== "quad")}</Pane>
        ) : null}
        lowerRight={visitedQuad || mode === "quad" ? (
          <Pane>{mountViewport(viewport2dQuadTop, "math-top", mode !== "quad")}</Pane>
        ) : null}
      />
      <CanvasEmptyState workspaceId={workspaceId} dimension={mode === "3d" ? "3d" : "2d"} startMinimized={mode === "quad"} onOpenGuide={onOpenGuide} onOpenExamples={onOpenExamples} onStart={onStart} gettingStarted={gettingStarted} />
    </div>
  );
}
