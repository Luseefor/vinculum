"use client";

import { IconOrbitAtom } from "@/components/showcase/icons";
import { Tabs } from "@/components/showcase/ui";

export default function InspectorEmptyState() {
  return (
    <aside className="inspector-panel" aria-label="Inspector panel">
      <div className="inspector-head">
        <p className="panel-kicker">Inspector</p>
        <Tabs
          className="inspector-tabs"
          tabs={[
            { id: "props", label: "Props" },
            { id: "style", label: "Style" },
            { id: "links", label: "Links" },
            { id: "anim", label: "Anim" },
            { id: "adv", label: "Adv" }
          ]}
          activeTab="props"
          onChange={() => undefined}
        />
      </div>
      <div className="inspector-empty">
        <div className="inspector-orbit-ring">
          <IconOrbitAtom />
        </div>
        <h3>No selection</h3>
        <p>
          Select an object to
          <br />
          edit its properties.
        </p>
      </div>
    </aside>
  );
}
