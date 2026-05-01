"use client";

import { Graph2DCanvas } from "@/components/graph/Graph2DCanvas";
import { IconButton } from "@/components/showcase/ui";
import { IconChevronDown, IconExpand, IconMore, IconSpark } from "@/components/showcase/icons";

export default function Graph2DViewport() {
  return (
    <section className="viewport-card viewport-2d" aria-label="2D graph viewport">
      <div className="viewport-pill viewport-pill-left">
        2D Graph - Plane (XY)
        <span className="icon-12"><IconChevronDown /></span>
      </div>

      <div className="viewport-controls-right">
        <IconButton icon={<span className="icon-14"><IconSpark /></span>} ariaLabel="2D settings" className="viewport-tool-btn" />
        <IconButton icon={<span>+</span>} ariaLabel="Zoom in" className="viewport-tool-btn" />
        <IconButton icon={<span>-</span>} ariaLabel="Zoom out" className="viewport-tool-btn" />
        <IconButton icon={<span className="icon-14"><IconExpand /></span>} ariaLabel="Fullscreen" className="viewport-tool-btn" />
      </div>

      <div className="viewport-pill viewport-pill-bottom-left">X: 0.79  Y: -0.25</div>

      <div className="viewport-canvas-wrap">
        <Graph2DCanvas className="h-full w-full" />
      </div>

      <div className="viewport-axis-label viewport-axis-y">Y</div>
      <div className="viewport-axis-label viewport-axis-x">X</div>
      <div className="viewport-axis-label viewport-axis-mark">0</div>

      <div className="viewport-ornament-grid" aria-hidden="true" />
      <div className="viewport-ornament-major" aria-hidden="true" />
      <IconButton icon={<span className="icon-12"><IconMore /></span>} className="viewport-corner-btn" ariaLabel="2D extra" />
    </section>
  );
}
