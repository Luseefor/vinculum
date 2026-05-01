"use client";

import dynamic from "next/dynamic";
import { IconButton } from "@/components/showcase/ui";
import { IconChevronDown, IconGrid, IconMore } from "@/components/showcase/icons";

const Graph3DCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-slate-400">Loading 3D view...</div>
});

interface Graph3DViewportProps {
  snapStep: number;
  toolLabel: string;
}

export default function Graph3DViewport({ snapStep, toolLabel }: Graph3DViewportProps) {
  return (
    <section className="viewport-card viewport-3d" aria-label="3D viewport">
      <div className="viewport-pill viewport-pill-left">
        3D View - Perspective
        <span className="icon-12"><IconChevronDown /></span>
      </div>

      <div className="orientation-cube" aria-hidden="true">
        <span className="cube-face cube-front" />
        <span className="cube-face cube-right" />
        <span className="cube-face cube-top" />
        <span className="cube-axis cube-x">X</span>
        <span className="cube-axis cube-y">Y</span>
        <span className="cube-axis cube-z">Z</span>
      </div>

      <div className="viewport-controls-right">
        <IconButton icon={<span>✋</span>} ariaLabel="Pan" className="viewport-tool-btn" />
        <IconButton icon={<span>⟳</span>} ariaLabel="Orbit" className="viewport-tool-btn" />
        <IconButton icon={<span>⌕</span>} ariaLabel="Zoom" className="viewport-tool-btn" />
        <IconButton icon={<span className="icon-14"><IconGrid /></span>} ariaLabel="Grid" className="viewport-tool-btn" />
      </div>

      <div className="viewport-pill viewport-pill-bottom">
        Snap: On ({snapStep.toFixed(2)}) &nbsp; Tool: {toolLabel} &nbsp; Orbit: Alt + Drag &nbsp; Zoom: Scroll &nbsp; Pan: Drag
      </div>

      <div className="viewport-canvas-wrap">
        <Graph3DCanvas />
      </div>

      <div className="viewport-3d-axes" aria-hidden="true">
        <span className="axis-line axis-x" />
        <span className="axis-line axis-y" />
        <span className="axis-line axis-z" />
      </div>

      <IconButton icon={<span className="icon-12"><IconMore /></span>} className="viewport-corner-btn" ariaLabel="3D extra" />
    </section>
  );
}
