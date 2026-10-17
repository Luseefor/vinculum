"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, CloseIcon, PlusIcon } from "@/components/layout/icons";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { createObjectByKey } from "@/lib/objects/objectCreation";
import { descriptorByKey } from "@/lib/objects/objectDescriptors";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import { useGraphStore } from "@/store/graphStore";
import type { WorkspaceId } from "@/types/graphUi";

export interface CanvasEmptyStateProps {
  workspaceId: WorkspaceId;
  dimension?: "2d" | "3d";
  onOpenGuide?: () => void;
  onOpenExamples?: () => void;
  onStart?: () => void;
  gettingStarted?: ReactNode;
  /** Keep all four panes clear until the user explicitly opens the launcher. */
  startMinimized?: boolean;
}

// One launcher per workspace, outside individual split/quad panes. Creation
// still uses the canonical object actions; hiding this panel is local UI only.
export default function CanvasEmptyState({ workspaceId, dimension, onOpenGuide, onOpenExamples, onStart, gettingStarted, startMinimized = false }: CanvasEmptyStateProps) {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const workspace = useGraphStore((state) => state.ui.workspace);
  const interacting = useGraphStore((state) => {
    const mode = dimension ?? (workspaceId === "geometry" ? "3d" : state.ui.graphMode);
    return (mode === "2d" ? state.ui.canvas2dTool : state.ui.canvas3dTool) !== "pan";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [expandedInQuad, setExpandedInQuad] = useState(false);
  const minimized = collapsed || (startMinimized && !expandedInQuad);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => { setExpandedInQuad(false); }, [startMinimized]);
  useEffect(() => {
    if (!restoreFocus.current) return;
    (minimized ? reopenRef : closeRef).current?.focus();
    restoreFocus.current = false;
  }, [minimized]);

  if (workspace !== workspaceId || objectCount > 0 || interacting) return null;

  const togglePanel = (next: boolean) => {
    restoreFocus.current = true;
    setCollapsed(next);
    if (startMinimized) setExpandedInQuad(!next);
    if (next) onStart?.();
  };
  if (minimized) return (
    <button ref={reopenRef} type="button" onClick={() => togglePanel(false)} className="canvas-start-reopen" aria-label="Show start panel">
      <PlusIcon className="h-4 w-4" /> Start
    </button>
  );

  const starters = workspaceId === "geometry"
    ? [{ key: "point", hint: "Coordinates" }, { key: "line", hint: "Point + direction" }, { key: "surface", hint: "z = f(x, y)" }]
    : [{ key: "surface", hint: "z = f(x, y)" }, { key: "parametricCurve", hint: "Path in space" }, { key: "vectorField-2d", hint: "Arrows + flow" }];
  const actions = starters.flatMap((starter) => {
    const entry = descriptorByKey(starter.key);
    return entry ? [{ ...entry, hint: starter.hint }] : [];
  });

  return (
    <div className="canvas-start-overlay">
      <section
        data-testid="canvas-empty-state"
        aria-label="Start panel"
        className="canvas-start-panel"
        onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); togglePanel(true); }
        }}
      >
        <AnimatedGroup className="canvas-start-content">
          <div className="canvas-start-header">
            <h2>{workspaceId === "geometry" ? "Start with geometry" : "Start a graph"}</h2>
            <p>{WORKSPACE_CONTENT[workspaceId].emptyHint}</p>
            <button ref={closeRef} type="button" aria-label="Hide start panel" onClick={() => togglePanel(true)} className="canvas-start-close">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          {onOpenExamples ? (
            <button type="button" onClick={event => { event.currentTarget.focus(); onOpenExamples(); }} className="canvas-start-example" data-start-primary>
              Open example <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : null}
          <div className="canvas-start-choices">
            <p className="canvas-start-label">{onOpenExamples ? "Or create an object" : "Create an object"}</p>
            {actions.map(entry => (
              <button key={entry.key} type="button" aria-label={`Create ${entry.label}`} onClick={() => { onStart?.(); createObjectByKey(entry.key); }} className="canvas-start-choice">
                <span className="canvas-start-choice-name"><PlusIcon className="canvas-start-plus h-3.5 w-3.5 shrink-0" />{entry.label}</span>
                <span className="canvas-start-choice-hint">{entry.hint}</span>
              </button>
            ))}
          </div>
          <div className="canvas-start-footer">
            <p>{workspaceId === "math" ? "Edit equations in Objects. Analyze in Inspector." : "Edit coordinates in Objects. Analyze in Inspector."}</p>
            {onOpenGuide ? <button type="button" onClick={event => { event.currentTarget.focus(); onOpenGuide(); }}>Where are the tools? <ArrowRightIcon className="h-3.5 w-3.5" /></button> : null}
          </div>
          {gettingStarted}
        </AnimatedGroup>
      </section>
    </div>
  );
}
