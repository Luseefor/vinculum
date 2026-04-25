"use client";

import { Panel } from "@/components/showcase/ui";

export default function ResizablePanelsCard() {
  return (
    <Panel className="details-card">
      <h3>RESIZABLE PANELS <span>(Mouse based)</span></h3>
      <div className="mini-diagram-row">
        <div className="mini-diagram">
          <div className="mini-split mini-split-v" />
          <p>Drag to resize</p>
        </div>
        <div className="mini-diagram">
          <div className="mini-split mini-collapse" />
          <p>Double click to collapse</p>
        </div>
        <div className="mini-diagram">
          <div className="mini-split mini-responsive" />
          <p>Responsive</p>
        </div>
      </div>
    </Panel>
  );
}
