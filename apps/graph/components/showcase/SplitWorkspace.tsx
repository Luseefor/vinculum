"use client";

import { useCallback, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import Graph2DViewport from "@/components/showcase/Graph2DViewport";
import Graph3DViewport from "@/components/showcase/Graph3DViewport";
import { DividerHandle } from "@/components/showcase/ui";

interface SplitWorkspaceProps {
  mode: "split" | "quad" | "single";
  snapStep: number;
  toolLabel: string;
}

export default function SplitWorkspace({ mode, snapStep, toolLabel }: SplitWorkspaceProps) {
  const [ratio, setRatio] = useState(0.5);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const root = event.currentTarget.parentElement;
    if (!root) {
      return;
    }
    const bounds = root.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const next = (moveEvent.clientX - bounds.left) / bounds.width;
      setRatio(Math.min(0.72, Math.max(0.28, next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const splitStyle = useMemo(() => ({
    gridTemplateColumns: `${(ratio * 100).toFixed(2)}% 8px minmax(0,1fr)`
  }), [ratio]);

  if (mode === "single") {
    return (
      <div className="workspace-single">
        <Graph3DViewport snapStep={snapStep} toolLabel={toolLabel} />
      </div>
    );
  }

  if (mode === "quad") {
    return (
      <div className="workspace-quad">
        <Graph2DViewport />
        <Graph3DViewport snapStep={snapStep} toolLabel={toolLabel} />
        <Graph3DViewport snapStep={snapStep} toolLabel={toolLabel} />
        <Graph2DViewport />
      </div>
    );
  }

  return (
    <div className="workspace-split" style={splitStyle}>
      <Graph2DViewport />
      <div className="workspace-divider" onPointerDown={startDrag}>
        <DividerHandle className="workspace-divider-handle" />
      </div>
      <Graph3DViewport snapStep={snapStep} toolLabel={toolLabel} />
    </div>
  );
}
